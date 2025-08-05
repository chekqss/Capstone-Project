// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    string[] public candidates;
    mapping(address => bool) public hasVoted;
    mapping(uint => uint) public votes;

    function addCandidate(string memory _name) public {
        candidates.push(_name);
    }

    function vote(uint _candidateId) public {
        require(!hasVoted[msg.sender], "You have already voted!");
        require(_candidateId < candidates.length, "Invalid candidate ID");

        hasVoted[msg.sender] = true;
        votes[_candidateId]++;
    }

    function getCandidates() public view returns (string[] memory) {
        return candidates;
    }
}
