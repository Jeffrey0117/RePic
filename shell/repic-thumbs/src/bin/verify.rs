//! PoC verification harness: ask the Windows shell for a file's thumbnail the
//! same way Explorer does (`IShellItemImageFactory::GetImage`, thumbnail-only),
//! then save the returned bitmap to PNG. If our registered `.repic` handler
//! works, running this on an embedded-thumb `.repic` yields the embedded image.
//!
//! Usage: verify.exe <input.repic> <output.png>

#![allow(non_snake_case)]

use std::ffi::c_void;

use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::Graphics::Imaging::*;
use windows::Win32::System::Com::StructuredStorage::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::Common::*;
use windows::Win32::UI::Shell::*;

const GENERIC_WRITE: u32 = 0x4000_0000;

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: verify <input.repic> <output.png>");
        std::process::exit(2);
    }
    let input = &args[1];
    let output = &args[2];

    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;

        let input_w = to_wide(input);
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(PCWSTR(input_w.as_ptr()), None)?;

        let size = SIZE { cx: 256, cy: 256 };
        // THUMBNAILONLY forces the shell to use a thumbnail handler (no icon fallback),
        // so a success here proves our handler produced the bitmap.
        let hbmp: HBITMAP = factory.GetImage(size, SIIGBF_THUMBNAILONLY)?;
        println!("GetImage returned HBITMAP: {:?}", hbmp);

        save_hbitmap_png(hbmp, output)?;
        let _ = DeleteObject(hbmp);
        println!("wrote {}", output);
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
    println!("thumbnail size: {}x{}", w, h);

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
