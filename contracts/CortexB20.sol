// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CortexB20
 * @dev B20 Standard Implementation for Autonomous AI Agent Memory Layer on Base.
 * Combines standard fungible token logic with autonomous agent roles for memory anchoring.
 */
contract CortexB20 {
    string public name = "Cortex Memory";
    string public symbol = "CTX";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;

    // B20 Specific: Agent Roles for Memory Capabilities
    mapping(string => address) public agentNodes;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AgentNodeRegistered(string agentId, address nodeAddress);
    event MemoryAnchored(string agentId, string memoryHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "CortexB20: caller is not the owner");
        _;
    }

    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, _initialSupply * 10 ** uint256(decimals));
    }

    // --- Standard B20 (ERC20 Equivalent) Functions ---

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "CortexB20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "CortexB20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "CortexB20: allowance exceeded");
        
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // --- Autonomous Agent Extension (B20 Specific) ---

    function registerAgentNode(string memory agentId, address nodeAddress) external onlyOwner {
        agentNodes[agentId] = nodeAddress;
        emit AgentNodeRegistered(agentId, nodeAddress);
    }

    function anchorMemory(string memory agentId, string memory memoryHash) external {
        require(agentNodes[agentId] == msg.sender, "CortexB20: unauthorized agent node");
        emit MemoryAnchored(agentId, memoryHash);
    }
}
