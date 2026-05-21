// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MemoryRegistry {
    struct MemoryRoot {
        address owner;
        string agentId;
        string gitlawbRef;
        bytes32 latestMemoryHash;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 commitCount;
        bool exists;
    }

    mapping(bytes32 => MemoryRoot) private roots;
    mapping(address => bytes32[]) private ownerRoots;

    event MemoryRootCreated(
        bytes32 indexed rootId,
        address indexed owner,
        string agentId,
        string gitlawbRef,
        uint256 createdAt
    );

    event MemoryCommitted(
        bytes32 indexed rootId,
        address indexed owner,
        bytes32 memoryHash,
        string sourceRef,
        string metadataURI,
        uint256 commitCount,
        uint256 committedAt
    );

    modifier onlyRootOwner(bytes32 rootId) {
        require(roots[rootId].exists, "MEMORY_ROOT_MISSING");
        require(roots[rootId].owner == msg.sender, "NOT_MEMORY_OWNER");
        _;
    }

    function createMemoryRoot(
        string calldata agentId,
        string calldata gitlawbRef
    ) external returns (bytes32 rootId) {
        require(bytes(agentId).length > 0, "AGENT_ID_REQUIRED");

        rootId = keccak256(
            abi.encodePacked(msg.sender, agentId, gitlawbRef, block.chainid)
        );

        require(!roots[rootId].exists, "MEMORY_ROOT_EXISTS");

        roots[rootId] = MemoryRoot({
            owner: msg.sender,
            agentId: agentId,
            gitlawbRef: gitlawbRef,
            latestMemoryHash: bytes32(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            commitCount: 0,
            exists: true
        });

        ownerRoots[msg.sender].push(rootId);

        emit MemoryRootCreated(rootId, msg.sender, agentId, gitlawbRef, block.timestamp);
    }

    function commitMemory(
        bytes32 rootId,
        bytes32 memoryHash,
        string calldata sourceRef,
        string calldata metadataURI
    ) external onlyRootOwner(rootId) {
        require(memoryHash != bytes32(0), "MEMORY_HASH_REQUIRED");

        MemoryRoot storage root = roots[rootId];
        root.latestMemoryHash = memoryHash;
        root.updatedAt = block.timestamp;
        root.commitCount += 1;

        emit MemoryCommitted(
            rootId,
            msg.sender,
            memoryHash,
            sourceRef,
            metadataURI,
            root.commitCount,
            block.timestamp
        );
    }

    function getMemoryRoot(bytes32 rootId) external view returns (MemoryRoot memory) {
        require(roots[rootId].exists, "MEMORY_ROOT_MISSING");
        return roots[rootId];
    }

    function getOwnerRoots(address owner) external view returns (bytes32[] memory) {
        return ownerRoots[owner];
    }
}
