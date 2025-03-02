// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ICompressor.sol";

contract CompressedStorage {

    address public compressor;

    mapping(uint256 => bytes) private storedData;

    uint256 public counter;

    event DataStored(
        uint256 id,
        uint256 originalSize,
        uint256 compressedSize,
        uint256 savedBytes
    );

    constructor(address _compressor) {
        require(_compressor != address(0), "Invalid compressor address");
        require(_compressor.code.length > 0, "Compressor must be a contract");

        compressor = _compressor;
    }

    function storeData(bytes calldata data) external returns (uint256 id) {

        require(data.length > 0, "Empty data");

        bytes memory compressed =
            ICompressor(compressor).compress(data);

        counter++;
        id = counter;

        storedData[id] = compressed;

        emit DataStored(
            id,
            data.length,
            compressed.length,
            data.length - compressed.length
        );
    }

    function retrieveData(uint256 id)
        external
        view
        returns (bytes memory)
    {
        require(id > 0 && id <= counter, "Invalid ID");

        bytes memory compressed = storedData[id];

        require(compressed.length > 0, "No stored data");

        return ICompressor(compressor).decompress(compressed);
    }

    function getCompressedData(uint256 id)
        external
        view
        returns (bytes memory)
    {
        require(id > 0 && id <= counter, "Invalid ID");
        return storedData[id];
    }
}