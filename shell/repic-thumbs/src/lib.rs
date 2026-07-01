//! Windows Shell Thumbnail Handler for `.repic` virtual image files.
//!
//! `.repic` files are tiny JSON pointers to (usually remote) images, so Explorer
//! shows the generic app icon for every one of them. This in-process COM server
//! implements `IThumbnailProvider` (fed via `IInitializeWithStream`) and renders
//! a thumbnail from a small image embedded in the JSON under the `thumb` key
//! (raw base64, optionally a `data:image/...;base64,` URL). No network I/O — the
//! same principle Explorer uses for real JPEG/PNG files (pixels live in the file).
//!
//! If there is no embedded `thumb`, we return an error so Explorer falls back to
//! the statically-registered `.repic` icon.

#![allow(non_snake_case)]

use std::cell::RefCell;
use std::ffi::c_void;
use std::sync::atomic::{AtomicIsize, Ordering};

use base64::Engine;
use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::Graphics::Imaging::*;
use windows::Win32::System::Com::*;
use windows::Win32::System::LibraryLoader::GetModuleFileNameW;
use windows::Win32::System::Registry::*;
use windows::Win32::UI::Shell::PropertiesSystem::*;
use windows::Win32::UI::Shell::*;

/// CLSID of this thumbnail provider. Stable, generated once for RePic.
const CLSID_REPIC_THUMB: GUID = GUID::from_u128(0x7E3D9A1C_2B4F_4C6E_9F80_1A2B3C4D5E6F);

/// Shell subkey under a file class that names an `IThumbnailProvider` handler.
const SHELLEX_THUMB_GUID: &str = "{e357fccd-a995-4576-b01f-234630154e96}";

/// Number of live COM objects + server locks; gates `DllCanUnloadNow`.
static DLL_REF_COUNT: AtomicIsize = AtomicIsize::new(0);
/// Our own HINSTANCE, captured in `DllMain`, used to resolve the DLL path.
static DLL_INSTANCE: AtomicIsize = AtomicIsize::new(0);

// ---------------------------------------------------------------------------
// COM object
// ---------------------------------------------------------------------------

#[implement(IInitializeWithStream, IThumbnailProvider)]
struct RepicThumbProvider {
    stream: RefCell<Option<IStream>>,
}

impl RepicThumbProvider {
    fn new() -> Self {
        DLL_REF_COUNT.fetch_add(1, Ordering::Relaxed);
        Self {
            stream: RefCell::new(None),
        }
    }
}

impl Drop for RepicThumbProvider {
    fn drop(&mut self) {
        DLL_REF_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
}

impl IInitializeWithStream_Impl for RepicThumbProvider_Impl {
    fn Initialize(&self, pstream: Option<&IStream>, _grfmode: u32) -> Result<()> {
        let stream = pstream.ok_or_else(|| Error::from(E_POINTER))?;
        *self.stream.borrow_mut() = Some(stream.clone());
        Ok(())
    }
}

impl IThumbnailProvider_Impl for RepicThumbProvider_Impl {
    fn GetThumbnail(
        &self,
        cx: u32,
        phbmp: *mut HBITMAP,
        pdwalpha: *mut WTS_ALPHATYPE,
    ) -> Result<()> {
        let stream = self
            .stream
            .borrow()
            .clone()
            .ok_or_else(|| Error::from(E_UNEXPECTED))?;

        let json_bytes = read_stream_to_end(&stream)?;
        // Normally the pixels come from the embedded `thumb`. If that's missing or
        // the file isn't JSON at all (e.g. a real image mislabeled `.repic`), fall
        // back to decoding the whole file as an image. If neither is decodable,
        // decode_to_hbitmap errors and the shell shows the registered icon.
        let img_bytes = match extract_embedded_thumb(&json_bytes) {
            Ok(bytes) => bytes,
            Err(_) => json_bytes,
        };
        let hbmp = decode_to_hbitmap(&img_bytes, cx)?;

        unsafe {
            *phbmp = hbmp;
            *pdwalpha = WTSAT_ARGB;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Stream + JSON + base64 helpers
// ---------------------------------------------------------------------------

fn read_stream_to_end(stream: &IStream) -> Result<Vec<u8>> {
    // Rewind to be safe — Explorer usually hands us a fresh stream, but don't assume.
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_SET, None)
            .ok()
            .unwrap_or(());
    }
    let mut out = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        let mut read: u32 = 0;
        let hr = unsafe {
            stream.Read(
                buf.as_mut_ptr() as *mut c_void,
                buf.len() as u32,
                Some(&mut read as *mut u32),
            )
        };
        if hr.is_err() && hr != S_FALSE {
            return Err(Error::from(hr));
        }
        if read == 0 {
            break;
        }
        out.extend_from_slice(&buf[..read as usize]);
        // Guard against absurd files — a .repic should be tiny.
        if out.len() > 8 * 1024 * 1024 {
            break;
        }
        if hr == S_FALSE {
            break;
        }
    }
    Ok(out)
}

/// Pull the embedded thumbnail out of the `.repic` JSON and return decoded image bytes.
fn extract_embedded_thumb(json_bytes: &[u8]) -> Result<Vec<u8>> {
    let value: serde_json::Value =
        serde_json::from_slice(json_bytes).map_err(|_| Error::from(E_FAIL))?;
    let thumb = value
        .get("thumb")
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::from(E_FAIL))?;

    // Strip an optional data-URL prefix: data:image/jpeg;base64,XXXX
    let b64 = match thumb.find("base64,") {
        Some(idx) => &thumb[idx + "base64,".len()..],
        None => thumb,
    };
    let cleaned: String = b64.split_whitespace().collect();

    base64::engine::general_purpose::STANDARD
        .decode(cleaned.as_bytes())
        .map_err(|_| Error::from(E_FAIL))
}

// ---------------------------------------------------------------------------
// WIC decode -> 32bpp premultiplied BGRA -> HBITMAP
// ---------------------------------------------------------------------------

fn decode_to_hbitmap(mut img_bytes: &[u8], cx: u32) -> Result<HBITMAP> {
    let cx = cx.max(1);
    // Copy into a mutable owned buffer for IWICStream::InitializeFromMemory.
    let mut owned: Vec<u8> = img_bytes.to_vec();
    img_bytes = &[]; // avoid accidental reuse
    let _ = img_bytes;

    unsafe {
        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let wic_stream = factory.CreateStream()?;
        wic_stream.InitializeFromMemory(&mut owned)?;

        let decoder = factory.CreateDecoderFromStream(
            &wic_stream,
            std::ptr::null(),
            WICDecodeMetadataCacheOnDemand,
        )?;
        let frame = decoder.GetFrame(0)?;

        let mut w = 0u32;
        let mut h = 0u32;
        frame.GetSize(&mut w, &mut h)?;
        if w == 0 || h == 0 {
            return Err(Error::from(E_FAIL));
        }

        // Fit the longest edge into cx, preserving aspect ratio.
        let scale = cx as f32 / w.max(h) as f32;
        let tw = ((w as f32 * scale).round() as u32).max(1);
        let th = ((h as f32 * scale).round() as u32).max(1);

        let scaler = factory.CreateBitmapScaler()?;
        scaler.Initialize(&frame, tw, th, WICBitmapInterpolationModeFant)?;

        let converter = factory.CreateFormatConverter()?;
        converter.Initialize(
            &scaler,
            &GUID_WICPixelFormat32bppPBGRA,
            WICBitmapDitherTypeNone,
            None,
            0.0,
            WICBitmapPaletteTypeCustom,
        )?;

        // Top-down 32bpp DIB so the pixel copy matches WIC's orientation.
        let mut bmi = BITMAPINFO::default();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = tw as i32;
        bmi.bmiHeader.biHeight = -(th as i32);
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB.0;

        let mut bits: *mut c_void = std::ptr::null_mut();
        let hbmp = CreateDIBSection(None, &bmi, DIB_RGB_COLORS, &mut bits, None, 0)?;
        if bits.is_null() {
            return Err(Error::from(E_FAIL));
        }

        let stride = tw * 4;
        let buf_len = (stride * th) as usize;
        let dst = std::slice::from_raw_parts_mut(bits as *mut u8, buf_len);
        converter.CopyPixels(std::ptr::null(), stride, dst)?;

        Ok(hbmp)
    }
}

// ---------------------------------------------------------------------------
// Class factory
// ---------------------------------------------------------------------------

#[implement(IClassFactory)]
struct ClassFactory;

impl IClassFactory_Impl for ClassFactory_Impl {
    fn CreateInstance(
        &self,
        punkouter: Option<&IUnknown>,
        riid: *const GUID,
        ppvobject: *mut *mut c_void,
    ) -> Result<()> {
        unsafe {
            *ppvobject = std::ptr::null_mut();
        }
        if punkouter.is_some() {
            return Err(Error::from(CLASS_E_NOAGGREGATION));
        }
        let unknown: IUnknown = RepicThumbProvider::new().into();
        unsafe { unknown.query(riid, ppvobject).ok() }
    }

    fn LockServer(&self, flock: BOOL) -> Result<()> {
        if flock.as_bool() {
            DLL_REF_COUNT.fetch_add(1, Ordering::Relaxed);
        } else {
            DLL_REF_COUNT.fetch_sub(1, Ordering::Relaxed);
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// DLL exports
// ---------------------------------------------------------------------------

#[no_mangle]
extern "system" fn DllMain(hinst: HINSTANCE, reason: u32, _reserved: *mut c_void) -> BOOL {
    const DLL_PROCESS_ATTACH: u32 = 1;
    if reason == DLL_PROCESS_ATTACH {
        DLL_INSTANCE.store(hinst.0 as isize, Ordering::Relaxed);
    }
    TRUE
}

#[no_mangle]
extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT {
    unsafe {
        if *rclsid != CLSID_REPIC_THUMB {
            return CLASS_E_CLASSNOTAVAILABLE;
        }
        let factory: IClassFactory = ClassFactory.into();
        factory.query(riid, ppv)
    }
}

#[no_mangle]
extern "system" fn DllCanUnloadNow() -> HRESULT {
    if DLL_REF_COUNT.load(Ordering::Relaxed) == 0 {
        S_OK
    } else {
        S_FALSE
    }
}

#[no_mangle]
extern "system" fn DllRegisterServer() -> HRESULT {
    match register() {
        Ok(()) => {
            unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None) };
            S_OK
        }
        Err(e) => e.code(),
    }
}

#[no_mangle]
extern "system" fn DllUnregisterServer() -> HRESULT {
    match unregister() {
        Ok(()) => {
            unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None) };
            S_OK
        }
        Err(e) => e.code(),
    }
}

// ---------------------------------------------------------------------------
// Registration (per-user, HKCU\Software\Classes — no elevation needed)
// ---------------------------------------------------------------------------

fn clsid_string() -> String {
    format!("{{{:?}}}", CLSID_REPIC_THUMB)
}

fn dll_path() -> Result<Vec<u16>> {
    let hmodule = HMODULE(DLL_INSTANCE.load(Ordering::Relaxed) as *mut c_void);
    let mut buf = vec![0u16; 1024];
    let len = unsafe { GetModuleFileNameW(hmodule, &mut buf) };
    if len == 0 {
        return Err(Error::from_win32());
    }
    buf.truncate(len as usize);
    Ok(buf)
}

fn register() -> Result<()> {
    let clsid = clsid_string();
    let dll = dll_path()?;

    // HKCU\Software\Classes\CLSID\{clsid}  (default) = friendly name
    let clsid_key = format!("Software\\Classes\\CLSID\\{}", clsid);
    write_string_value(HKEY_CURRENT_USER, &clsid_key, None, "RePic Thumbnail Handler")?;

    // ...\InprocServer32 (default) = dll path, ThreadingModel = Apartment
    let inproc_key = format!("{}\\InprocServer32", clsid_key);
    write_string_value_wide(HKEY_CURRENT_USER, &inproc_key, None, &dll)?;
    write_string_value(HKEY_CURRENT_USER, &inproc_key, Some("ThreadingModel"), "Apartment")?;

    // HKCU\Software\Classes\.repic\ShellEx\{thumb-guid} (default) = {clsid}
    let assoc_key = format!("Software\\Classes\\.repic\\ShellEx\\{}", SHELLEX_THUMB_GUID);
    write_string_value(HKEY_CURRENT_USER, &assoc_key, None, &clsid)?;

    Ok(())
}

fn unregister() -> Result<()> {
    let clsid = clsid_string();
    let assoc_key = format!("Software\\Classes\\.repic\\ShellEx\\{}", SHELLEX_THUMB_GUID);
    let _ = delete_tree(HKEY_CURRENT_USER, &assoc_key);
    let clsid_key = format!("Software\\Classes\\CLSID\\{}", clsid);
    let _ = delete_tree(HKEY_CURRENT_USER, &clsid_key);
    Ok(())
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn write_string_value(
    root: HKEY,
    subkey: &str,
    name: Option<&str>,
    value: &str,
) -> Result<()> {
    write_string_value_wide(root, subkey, name, &to_wide(value))
}

/// `value_wide` must be NUL-terminated.
fn write_string_value_wide(
    root: HKEY,
    subkey: &str,
    name: Option<&str>,
    value_wide: &[u16],
) -> Result<()> {
    let subkey_w = to_wide(subkey);
    let name_w = name.map(to_wide);
    unsafe {
        let mut hkey = HKEY::default();
        let status = RegCreateKeyExW(
            root,
            PCWSTR(subkey_w.as_ptr()),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut hkey,
            None,
        );
        if status.is_err() {
            return Err(Error::from(status.to_hresult()));
        }

        // Ensure the value is stored with its terminating NUL included.
        let mut owned = value_wide.to_vec();
        if owned.last() != Some(&0) {
            owned.push(0);
        }
        let bytes = std::slice::from_raw_parts(
            owned.as_ptr() as *const u8,
            owned.len() * std::mem::size_of::<u16>(),
        );
        let name_ptr = match &name_w {
            Some(n) => PCWSTR(n.as_ptr()),
            None => PCWSTR::null(),
        };
        let status = RegSetValueExW(hkey, name_ptr, 0, REG_SZ, Some(bytes));
        let _ = RegCloseKey(hkey);
        if status.is_err() {
            return Err(Error::from(status.to_hresult()));
        }
    }
    Ok(())
}

fn delete_tree(root: HKEY, subkey: &str) -> Result<()> {
    let subkey_w = to_wide(subkey);
    unsafe {
        let status = RegDeleteTreeW(root, PCWSTR(subkey_w.as_ptr()));
        if status.is_err() {
            return Err(Error::from(status.to_hresult()));
        }
    }
    Ok(())
}
