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
        bool claimed; // Prevent re-entrancy
    }

    struct ClaimRequest {
        address claimant;
        bytes32 claimHash;
        bool exists;
    }

    mapping(bytes32 => Deposit) public deposits;
    mapping(bytes32 => ClaimRequest) public claims;
    mapping(address => bytes32[]) public depositorDeposits;

    event Deposited(address indexed depositor, address indexed token, uint256 amount, bytes32 indexed depositId, uint256 unlockTime);
    event ClaimInitiated(address indexed claimant, bytes32 indexed depositId, bytes32 claimHash);
    event Claimed(address indexed destination, address indexed token, uint256 amount, bytes32 indexed depositId);
    event Refunded(address indexed depositor, address indexed token, uint256 amount, bytes32 indexed depositId);

    function deposit(address token, uint256 amount, bytes32 passphraseHash, uint256 unlockTime) external {
        if (unlockTime != 0) {
            require(unlockTime > block.timestamp, "Unlock time must be in the future");
        }

        bytes32 depositId = keccak256(abi.encodePacked(msg.sender, token, amount, passphraseHash, unlockTime));

        deposits[depositId] = Deposit({
            depositor: msg.sender,
            token: token,
            amount: amount,
            passphraseHash: passphraseHash,
            unlockTime: unlockTime,
            claimed: false
        });

        depositorDeposits[msg.sender].push(depositId);
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, token, amount, depositId, unlockTime);
    }

    function claim(bytes32 depositId, bytes32 claimHash) external {
        Deposit storage deposit = deposits[depositId];
        require(deposit.amount > 0, "No deposit found");
        if (deposit.unlockTime != 0) {
            require(block.timestamp >= deposit.unlockTime, "Vault is locked");
        }
        require(!deposit.claimed, "Already claimed");

        claims[depositId] = ClaimRequest({
            claimant: msg.sender,
            claimHash: claimHash,
            exists: true
        });
        console.log("Solidity Claim Logs");
        console.logBytes32(claimHash);

        emit ClaimInitiated(msg.sender, depositId, claimHash);
    }

    function revealClaim(bytes32 depositId, string memory passphrase, address destination) external {
        Deposit storage deposit = deposits[depositId];
        ClaimRequest storage claimRequest = claims[depositId];

        require(claimRequest.exists, "No claim found");
        require(!deposit.claimed, "Already claimed");
        require(keccak256(abi.encodePacked(passphrase)) == deposit.passphraseHash, "Invalid passphrase");
        console.logBytes32(keccak256(abi.encodePacked(passphrase, destination)));

        require(keccak256(abi.encodePacked(passphrase, destination)) == claimRequest.claimHash, "Invalid reveal");

        deposit.claimed = true;
        uint256 amount = deposit.amount;
        deposit.amount = 0;

        IERC20(deposit.token).transfer(destination, amount);

        emit Claimed(destination, deposit.token, amount, depositId);
    }

    function refund(bytes32 depositId) external {
        Deposit storage deposit = deposits[depositId];
        require(deposit.amount > 0, "No tokens to refund");
        require(msg.sender == deposit.depositor, "Not authorized");
        require(!deposit.claimed, "Already claimed");

        uint256 amount = deposit.amount;
        deposit.amount = 0;

        IERC20(deposit.token).transfer(msg.sender, amount);

        emit Refunded(msg.sender, deposit.token, amount, depositId);
    }

    function getDepositorDeposits(address depositor) external view returns (bytes32[] memory) {
        return depositorDeposits[depositor];
    }

    function getDepositDetails(bytes32 depositId) external view returns (
        address depositor,
        address token,
        uint256 amount,
        bytes32 passphraseHash,
        uint256 unlockTime,
        bool claimed
    ) {
        Deposit storage deposit = deposits[depositId];
        return (
            deposit.depositor,
            deposit.token,
            deposit.amount,
            deposit.passphraseHash,
            deposit.unlockTime,
            deposit.claimed
        );
    }
}