// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICompressor {

    function compress(bytes calldata data)
        external
        view
        returns (bytes memory);

    function decompress(bytes calldata data)
        external
        view
        returns (bytes memory);
}