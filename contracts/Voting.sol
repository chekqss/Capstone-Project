// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Commit–Reveal E-Voting (one person = one vote)
 * - Off-chain authorizer signs permissions; user self-registers on-chain.
 * - Commit during commit window, reveal during reveal window.
 * - One vote per address, enforced by mappings.
 */
contract Voting {
    event VoterRegistered(address indexed voter);
    event VoteCommitted(address indexed voter, bytes32 commitment);
    event VoteRevealed(address indexed voter, uint256 indexed candidateId);
    event EncryptedBallotAnchored(address indexed voter, bytes32 ballotHash);
    event TallyFinalized(uint256[] results);

    address public authorizer;
    address public admin;

    uint256 public commitStart;
    uint256 public commitEnd;
    uint256 public revealEnd;

    string[] public candidates;
    mapping(uint256 => uint256) public tally;
    bool public finalTallyDone;

    mapping(address => bool) public isRegistered;
    mapping(address => bool) public hasCommitted;
    mapping(address => bool) public hasRevealed;
    mapping(address => bytes32) public voteCommitment;

    constructor(
        address _authorizer,
        uint256 _commitStart,
        uint256 _commitEnd,
        uint256 _revealEnd
    ) {
        require(_authorizer != address(0), "bad authorizer");
        require(_commitStart < _commitEnd && _commitEnd < _revealEnd, "bad windows");
        authorizer = _authorizer;
        admin = msg.sender;
        commitStart = _commitStart;
        commitEnd = _commitEnd;
        revealEnd = _revealEnd;
    }

    modifier onlyAdmin() { require(msg.sender == admin, "not admin"); _; }

    function addCandidate(string calldata name) external onlyAdmin {
        require(bytes(name).length > 0, "empty name");
        candidates.push(name);
    }

    function candidatesCount() external view returns (uint256) {
        return candidates.length;
    }

    function setWindows(uint256 _commitStart, uint256 _commitEnd, uint256 _revealEnd) external onlyAdmin {
        require(block.timestamp < commitStart, "cannot change after start");
        require(_commitStart < _commitEnd && _commitEnd < _revealEnd, "bad windows");
        commitStart = _commitStart;
        commitEnd = _commitEnd;
        revealEnd = _revealEnd;
    }

    function setAuthorizer(address _authorizer) external onlyAdmin {
        require(_authorizer != address(0), "bad authorizer");
        authorizer = _authorizer;
    }

    // Off-chain backend signs keccak256("VOTE", chainId, voter) as an EIP-191 message
    function registerVoter(bytes calldata signature) external {
        require(!isRegistered[msg.sender], "already registered");
        bytes32 digest = keccak256(abi.encodePacked(bytes4(0x564f5445), block.chainid, msg.sender));
        address recovered = recoverSigner(digest, signature);
        require(recovered == authorizer, "invalid signature");
        isRegistered[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }

    // commitment = keccak256(abi.encodePacked(candidateId, salt, msg.sender))
    function commitVote(bytes32 commitment) external {
        require(block.timestamp >= commitStart && block.timestamp <= commitEnd, "not commit phase");
        require(isRegistered[msg.sender], "not registered");
        require(!hasCommitted[msg.sender], "already committed");
        voteCommitment[msg.sender] = commitment;
        hasCommitted[msg.sender] = true;
        emit VoteCommitted(msg.sender, commitment);
    }

    function revealVote(uint256 candidateId, bytes32 salt) external {
        require(block.timestamp > commitEnd && block.timestamp <= revealEnd, "not reveal phase");
        require(hasCommitted[msg.sender], "no commit");
        require(!hasRevealed[msg.sender], "already revealed");
        require(candidateId < candidates.length, "bad candidate");

        bytes32 expected = keccak256(abi.encodePacked(candidateId, salt, msg.sender));
        require(expected == voteCommitment[msg.sender], "commitment mismatch");

        hasRevealed[msg.sender] = true;
        tally[candidateId] += 1;
        emit VoteRevealed(msg.sender, candidateId);
    }

    function recordEncryptedBallotHash(bytes32 ballotHash) external {
        require(block.timestamp >= commitStart && block.timestamp <= commitEnd, "not commit phase");
        require(isRegistered[msg.sender], "not registered");
        emit EncryptedBallotAnchored(msg.sender, ballotHash);
    }

    function getResults() external view returns (uint256[] memory) {
        uint256 n = candidates.length;
        uint256[] memory results = new uint256[](n);
        for (uint256 i = 0; i < n; i++) results[i] = tally[i];
        return results;
    }

    function tallyVotes() external {
        require(block.timestamp > revealEnd, "reveal not ended");
        require(!finalTallyDone, "already tallied");
        finalTallyDone = true;

        uint256 n = candidates.length;
        uint256[] memory results = new uint256[](n);
        for (uint256 i = 0; i < n; i++) results[i] = tally[i];
        emit TallyFinalized(results);
    }

    // ECDSA helpers
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        return ecrecover(ethSigned, v, r, s);
    }
    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "bad sig len");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
