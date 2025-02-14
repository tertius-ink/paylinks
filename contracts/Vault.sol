// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "hardhat/console.sol";

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract PassphraseVault {

    struct Deposit {
        address depositor;
        address token;
        uint256 amount;
        bytes32 passphraseHash;
        uint256 unlockTime;
    }

    mapping(bytes32 => Deposit) public deposits;
    mapping(address => bytes32[]) public depositorDeposits;

    event Deposited(address indexed depositor, address indexed token, uint256 amount, bytes32 indexed depositId, uint256 unlockTime);
    event Claimed(address indexed collector, address indexed token, uint256 amount, bytes32 indexed depositId);
    event Refunded(address indexed depositor, address indexed token, uint256 amount, bytes32 indexed depositId);

    function deposit(address token, uint256 amount, string memory passphrase, uint256 unlockTime) external {
        require(unlockTime > block.timestamp, "Unlock time must be in the future");

        bytes32 passphraseHash = keccak256(abi.encodePacked(passphrase));
        bytes32 depositId = keccak256(abi.encodePacked(msg.sender, token, amount, passphraseHash, unlockTime));

        deposits[depositId] = Deposit({
            depositor: msg.sender,
            token: token,
            amount: amount,
            passphraseHash: passphraseHash,
            unlockTime: unlockTime
        });

        depositorDeposits[msg.sender].push(depositId);

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, token, amount, depositId, unlockTime);
    }

    function claim(bytes32 depositId, string memory passphrase) external {
        Deposit storage deposit = deposits[depositId];
        require(deposit.amount > 0, "No tokens to claim");
        require(block.timestamp >= deposit.unlockTime, "Vault is locked");
        require(keccak256(abi.encodePacked(passphrase)) == deposit.passphraseHash, "Invalid passphrase");

        uint256 amount = deposit.amount;
        address token = deposit.token;
        deposit.amount = 0;

        IERC20(token).transfer(msg.sender, amount);

        emit Claimed(msg.sender, token, amount, depositId);
    }

    function claimWithSignature(bytes32 depositId, uint8 v, bytes32 r, bytes32 s) external {
        Deposit storage deposit = deposits[depositId];
        console.log("Solidity Logs");
        console.logBytes32(depositId);
        require(deposit.amount > 0, "No deposit found");
        require(block.timestamp >= deposit.unlockTime, "Vault is locked");

        // Add the Ethereum prefix to the message to match what was signed off-chain
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", depositId));

        // Verify signature
        address signer = ecrecover(messageHash, v, r, s);
        console.log(v);
        console.logBytes32(r);
        console.logBytes32(s);
        console.log(signer);
        require(signer == deposit.depositor, "Invalid signature");

        uint256 amount = deposit.amount;
        address token = deposit.token;
        deposit.amount = 0;

        IERC20(token).transfer(msg.sender, amount);

        emit Claimed(msg.sender, token, amount, depositId);
    }

    function refund(bytes32 depositId) external {
        Deposit storage deposit = deposits[depositId];
        require(deposit.amount > 0, "No tokens to refund");
        require(msg.sender == deposit.depositor, "Not authorized");

        uint256 amount = deposit.amount;
        address token = deposit.token;
        deposit.amount = 0;

        IERC20(token).transfer(msg.sender, amount);

        emit Refunded(msg.sender, token, amount, depositId);
    }

    function getDepositorDeposits(address depositor) external view returns (bytes32[] memory) {
        return depositorDeposits[depositor];
    }
}