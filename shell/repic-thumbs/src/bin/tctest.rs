//! Faithful reproduction of Explorer's folder-view thumbnail path via
//! IThumbnailCache (CLSID_LocalThumbnailCache) — the exact pipeline Explorer
//! uses. Unlike IShellItemImageFactory, this respects the shell's decision of
//! whether to consult a thumbnail provider at all. If our handler runs, the
//! handler log gets a line; the produced bitmap is saved to inspect.
//!
//! Usage: tctest.exe <file> <out.png>

#![allow(non_snake_case)]

use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::Graphics::Imaging::*;
use windows::Win32::System::Com::StructuredStorage::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::*;

const GENERIC_WRITE: u32 = 0x4000_0000;
const CLSID_LOCAL_THUMBNAIL_CACHE: GUID = GUID::from_u128(0x50ef4544_ac9f_4a8e_b21b_8a26180db13f);

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: tctest <file> <out.png>");
        std::process::exit(2);
    }
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;

        let cache: IThumbnailCache =
            CoCreateInstance(&CLSID_LOCAL_THUMBNAIL_CACHE, None, CLSCTX_INPROC_SERVER)?;

        let path = to_wide(&args[1]);
        let item: IShellItem = SHCreateItemFromParsingName(PCWSTR(path.as_ptr()), None)?;

        // arg3: "force" (bypass shell's thumbnailable decision) or "normal"
        // (WTS_EXTRACT=0, exactly Explorer's folder-view behavior).
        let mode = args.get(3).map(|s| s.as_str()).unwrap_or("force");
        let flags = if mode == "normal" {
            WTS_EXTRACT
        } else {
            WTS_FORCEEXTRACTION | WTS_EXTRACTDONOTCACHE
        };
        println!("mode: {}", mode);
        let mut shared: Option<ISharedBitmap> = None;
        let mut outflags = WTS_CACHEFLAGS(0);
        let mut id = WTS_THUMBNAILID::default();
        let hr = cache.GetThumbnail(
            &item,
            256,
            flags,
            Some(&mut shared as *mut Option<ISharedBitmap>),
            Some(&mut outflags),
            Some(&mut id),
        );
        match hr {
            Ok(()) => {
                println!("GetThumbnail OK, outflags={:#x}", outflags.0);
                if let Some(sb) = shared {
                    let hbmp = sb.GetSharedBitmap()?;
                    save_hbitmap_png(hbmp, &args[2])?;
                    println!("saved {}", args[2]);
                }
            }
            Err(e) => println!("GetThumbnail FAILED: {:?}", e.code()),
        }
    }
    Ok(())
}

unsafe fn save_hbitmap_png(hbmp: HBITMAP, output: &str) -> Result<()> {
    let wic: IWICImagingFactory =
        CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;
    let bitmap = wic.CreateBitmapFromHBITMAP(hbmp, HPALETTE::default(), WICBitmapUseAlpha)?;
    let mut w = 0u32;
    let mut h = 0u32;
    bitmap.GetSize(&mut w, &mut h)?;
    println!("bitmap size: {}x{}", w, h);
    let stream = wic.CreateStream()?;
    let out_w = to_wide(output);
    stream.InitializeFromFilename(PCWSTR(out_w.as_ptr()), GENERIC_WRITE)?;
    let encoder = wic.CreateEncoder(&GUID_ContainerFormatPng, std::ptr::null())?;
    encoder.Initialize(&stream, WICBitmapEncoderNoCache)?;
    let mut frame: Option<IWICBitmapFrameEncode> = None;
    let mut props: Option<IPropertyBag2> = None;
    encoder.CreateNewFrame(&mut frame, &mut props)?;
    let frame = frame.unwrap();
    frame.Initialize(props.as_ref())?;
    frame.SetSize(w, h)?;
    let mut fmt = GUID_WICPixelFormat32bppBGRA;
    frame.SetPixelFormat(&mut fmt)?;
    frame.WriteSource(&bitmap, std::ptr::null())?;
    frame.Commit()?;
    encoder.Commit()?;
    Ok(())
}
