#![no_std]

extern crate alloc;

use alloc::vec::Vec;
use lz4_flex::{block::compress_prepend_size, block::decompress_size_prepended};

// Define a struct to return both pointer and length
#[repr(C)]
pub struct ResultPointer {
    ptr: *mut u8,
    len: usize,
}

#[no_mangle]
pub extern "C" fn compress(ptr: *const u8, len: usize) -> ResultPointer {
    let input = unsafe { core::slice::from_raw_parts(ptr, len) };
    let compressed: Vec<u8> = compress_prepend_size(input);

    let boxed_result = compressed.into_boxed_slice();
    let out_ptr = boxed_result.as_ptr() as *mut u8;
    let out_len = boxed_result.len();

    // Leak the memory so it lives beyond this function
    core::mem::forget(boxed_result);

    ResultPointer {
        ptr: out_ptr,
        len: out_len,
    }
}

#[no_mangle]
pub extern "C" fn decompress(ptr: *const u8, len: usize) -> ResultPointer {
    let input = unsafe { core::slice::from_raw_parts(ptr, len) };
    let decompressed: Vec<u8> = decompress_size_prepended(input).expect("decompression failed");

    let boxed_result = decompressed.into_boxed_slice();
    let out_ptr = boxed_result.as_ptr() as *mut u8;
    let out_len = boxed_result.len();

    core::mem::forget(boxed_result);

    ResultPointer {
        ptr: out_ptr,
        len: out_len,
    }
}

#[no_mangle]
pub extern "C" fn free_result(ptr: *mut u8, len: usize) {
    unsafe {
        if !ptr.is_null() {
            // Reconstruct the boxed slice and let it drop
            let _ = core::slice::from_raw_parts_mut(ptr, len);
            // Once it goes out of scope, memory is freed
        }
    }
}