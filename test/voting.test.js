const Voting = artifacts.require("Voting");
const { soliditySha3, randomHex } = web3.utils;

async function increaseTime(seconds) {
  await web3.currentProvider.send(
    { jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: Date.now() },
    () => {}
  );
  await web3.currentProvider.send(
    { jsonrpc: "2.0", method: "evm_mine", params: [], id: Date.now() },
    () => {}
  );
}

function authDigest(addr, chainId) {
  return soliditySha3(
    { t: "bytes4", v: "0x564f5445" }, // "VOTE"
    { t: "uint256", v: chainId },
    { t: "address", v: addr }
  );
}

contract("Voting", (accounts) => {
  const [authorizer, voter] = accounts;

  it("full flow: register -> commit -> reveal -> tally", async () => {
    // Create short windows for testing
    const now = Math.floor(Date.now() / 1000);
    const commitStart = now + 1;
    const commitEnd   = commitStart + 60;
    const revealEnd   = commitEnd + 60;

    const v = await Voting.new(authorizer, commitStart, commitEnd, revealEnd);
    await v.addCandidate("Alice");
    await v.addCandidate("Bob");

    // Prepare registration signature (simulate backend)
    const chainId = await web3.eth.getChainId();
    const digest = authDigest(voter, chainId);
    const sig = await web3.eth.sign(digest, authorizer);

    // Jump to commitStart
    await increaseTime(2);
    await v.registerVoter(sig, { from: voter });

    const candidateId = 0;
    const salt = randomHex(32);
    const commitment = soliditySha3(
      { t: "uint256", v: candidateId },
      { t: "bytes32", v: salt },
      { t: "address", v: voter }
    );

    await v.commitVote(commitment, { from: voter });

    // Move to reveal phase
    await increaseTime(70);
    await v.revealVote(candidateId, salt, { from: voter });

    // Move past reveal end and tally
    await increaseTime(70);
    await v.tallyVotes();

    const results = await v.getResults();
    assert.equal(results[0].toString(), "1");
  });
});
