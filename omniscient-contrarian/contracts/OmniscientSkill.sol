// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OmniscientSkill
 * @dev Implementation of an ERC-8183 compliant agent skill for selling signals.
 */
contract OmniscientSkill {
    address public owner;
    
    // Mapping from subscriber to their expiration timestamp
    mapping(address => uint256) public subscriptions;
    
    // Current conviction score (0-100)
    uint256 private currentSignal;
    
    // Fee per day in wei (for native BNB, or can be adapted for x402)
    uint256 public subscriptionFeePerDay;

    event Subscribed(address indexed subscriber, uint256 duration);
    event SignalUpdated(uint256 newSignal);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _feePerDay) {
        owner = msg.sender;
        subscriptionFeePerDay = _feePerDay;
    }

    /**
     * @dev Subscribe to the skill (ERC-8183 concept)
     * @param duration Number of days to subscribe
     */
    function subscribe(uint256 duration) external payable {
        uint256 totalCost = duration * subscriptionFeePerDay;
        require(msg.value >= totalCost, "Insufficient payment");

        uint256 currentExpiration = subscriptions[msg.sender] > block.timestamp 
            ? subscriptions[msg.sender] 
            : block.timestamp;

        subscriptions[msg.sender] = currentExpiration + (duration * 1 days);

        emit Subscribed(msg.sender, duration);
    }

    /**
     * @dev Agent updates the signal on-chain
     */
    function updateSignal(uint256 newSignal) external onlyOwner {
        require(newSignal <= 100, "Signal out of bounds");
        currentSignal = newSignal;
        emit SignalUpdated(newSignal);
    }

    /**
     * @dev Get the current signal, requires active subscription
     */
    function getSignal(address subscriber) public view returns (uint256) {
        require(subscriptions[subscriber] > block.timestamp || subscriber == owner, "No active subscription");
        return currentSignal;
    }

    /**
     * @dev Withdraw earned fees
     */
    function withdrawEarnings() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Transfer failed");
    }
}
