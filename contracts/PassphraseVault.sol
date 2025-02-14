// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PassphraseVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Deposit {
        address depositor;
        address token;
        uint256 amount;
        bytes32 passphraseHash;
        bool claimed;
        mapping(address => CommitInfo) commits;  // Track commits per address
    }

    struct CommitInfo {
        bytes32 commitHash;
        uint256 commitDeadline;
    }

    mapping(uint256 => Deposit) public deposits;
    uint256 public nextDepositId;

    // Change MIN_COMMIT_DELAY to 1 block minimum
    uint256 public constant MIN_COMMIT_DELAY = 1;  // 1 block
    uint256 public constant COMMIT_DURATION = 10 minutes;

    event DepositCreated(
        uint256 indexed depositId,
        address indexed depositor,
        address indexed token,
        uint256 amount
    );
    event CommitSubmitted(uint256 indexed depositId, address indexed committer);
    event DepositClaimed(uint256 indexed depositId, address indexed claimer);

    constructor() {
        nextDepositId = 1;
    }

    function createDeposit(
        address token,
        uint256 amount,
        bytes32 passphraseHash
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(token != address(0), "Invalid token address");

        uint256 depositId = nextDepositId++;

        Deposit storage newDeposit = deposits[depositId];
        newDeposit.depositor = msg.sender;
        newDeposit.token = token;
        newDeposit.amount = amount;
        newDeposit.passphraseHash = passphraseHash;
        newDeposit.claimed = false;

        // Transfer tokens from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositCreated(depositId, msg.sender, token, amount);
        return depositId;
    }

    function submitCommit(
        uint256 depositId,
        bytes32 commitHash
    ) external nonReentrant {
        Deposit storage deposit = deposits[depositId];
        require(!deposit.claimed, "Deposit already claimed");

        // Each address can have their own commit
        CommitInfo storage commit = deposit.commits[msg.sender];

        // Allow overwriting own expired commit
        require(commit.commitHash == bytes32(0) || block.timestamp > commit.commitDeadline,
            "Your previous commit is still valid");

        commit.commitHash = commitHash;
        // Start the window after MIN_COMMIT_DELAY
        commit.commitDeadline = block.timestamp + COMMIT_DURATION;

        emit CommitSubmitted(depositId, msg.sender);
    }

    function reveal(
        uint256 depositId,
        string calldata passphrase,
        bytes32 nonce
    ) external nonReentrant {
        Deposit storage deposit = deposits[depositId];
        require(!deposit.claimed, "Deposit already claimed");

        CommitInfo storage commit = deposit.commits[msg.sender];
        require(commit.commitHash != bytes32(0), "No commit found");
        require(block.timestamp <= commit.commitDeadline, "Commit expired");
        // Add minimum delay check
        require(block.timestamp >= commit.commitDeadline - COMMIT_DURATION + MIN_COMMIT_DELAY,
            "Must wait minimum time after commit");

        // Verify the commit hash
        bytes32 computedCommitHash = keccak256(abi.encodePacked(passphrase, nonce, msg.sender));
        require(computedCommitHash == commit.commitHash, "Invalid commit");

        // Verify the passphrase
        bytes32 computedPassphraseHash = keccak256(abi.encodePacked(passphrase));
        require(computedPassphraseHash == deposit.passphraseHash, "Invalid passphrase");

        deposit.claimed = true;

        // Transfer tokens to claimer
        IERC20(deposit.token).safeTransfer(msg.sender, deposit.amount);

        emit DepositClaimed(depositId, msg.sender);
    }

    // Update view function to check deposit details
    function getDeposit(uint256 depositId, address committer) external view returns (
        address depositor,
        address token,
        uint256 amount,
        bool claimed,
        uint256 commitDeadline,
        bytes32 commitHash
    ) {
        Deposit storage deposit = deposits[depositId];
        CommitInfo storage commit = deposit.commits[committer];
        return (
            deposit.depositor,
            deposit.token,
            deposit.amount,
            deposit.claimed,
            commit.commitDeadline,
            commit.commitHash
        );
    }
}
