const Voting = artifacts.require("Voting");

module.exports = async function (deployer, network, accounts) {
  // use the chain timestamp to build strictly increasing windows
  const latestBlock = await web3.eth.getBlock("latest");
  const now = Number(latestBlock.timestamp);

  const commitStart = now + 90;
  const commitEnd   = commitStart + 5 * 60;
  const revealEnd   = commitEnd + 5 * 60;

  await deployer.deploy(
    Voting,
    accounts[0],
    commitStart,
    commitEnd,
    revealEnd,
    { from: accounts[0], gas: 6500000 }
  );

  const voting = await Voting.deployed();
  await voting.addCandidate("Alice",   { from: accounts[0] });
  await voting.addCandidate("Bob",     { from: accounts[0] });
  await voting.addCandidate("Charlie", { from: accounts[0] });
};
