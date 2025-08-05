// Connect to MetaMask
if (typeof window.ethereum !== 'undefined') {
  window.web3 = new Web3(window.ethereum);
  window.ethereum.request({ method: 'eth_requestAccounts' });
} else {
  alert("Please install MetaMask to use this dApp");
}

// Smart Contract ABI & Address (update after deploying)
const contractABI = [
  {
    "inputs":[{"internalType":"string","name":"_name","type":"string"}],
    "name":"addCandidate",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"_candidateId","type":"uint256"}],
    "name":"vote",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "inputs":[],
    "name":"getCandidates",
    "outputs":[{"internalType":"string[]","name":"","type":"string[]"}],
    "stateMutability":"view",
    "type":"function"
  }
];

const contractAddress = "0xYourContractAddress"; // Replace with your deployed address
const contract = new web3.eth.Contract(contractABI, contractAddress);

async function vote() {
  const candidateId = document.getElementById("candidateId").value;
  const accounts = await web3.eth.getAccounts();
  await contract.methods.vote(candidateId).send({ from: accounts[0] });
  alert("Vote submitted!");
}
