import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { ethers } from 'ethers';
import { z } from 'zod';

const app = express();
app.use(helmet());
app.use(cors());                // allow frontend to call us
app.use(express.json());
app.use(morgan('dev'));

const {
  AUTHORIZER_PRIVATE_KEY,
  RPC_URL,
  VOTING_ADDRESS,
  PORT = 4000
} = process.env;

if (!AUTHORIZER_PRIVATE_KEY || !RPC_URL || !VOTING_ADDRESS) {
  console.error("Missing env vars: AUTHORIZER_PRIVATE_KEY, RPC_URL, VOTING_ADDRESS");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(AUTHORIZER_PRIVATE_KEY, provider);

// Minimal ABI needed by backend
const votingAbi = [
  "function authorizer() view returns (address)",
  "function candidatesCount() view returns (uint256)",
  "function getResults() view returns (uint256[])",
  "event VoterRegistered(address indexed voter)",
  "event VoteCommitted(address indexed voter, bytes32 commitment)",
  "event VoteRevealed(address indexed voter, uint256 indexed candidateId)",
  "event EncryptedBallotAnchored(address indexed voter, bytes32 ballotHash)"
];
const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, provider);

// Prevent double-registration by email (toy store)
const seenEmails = new Set();

// Issue registration signature after simple "verification"
app.post('/api/authorize', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      voterAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    });
    const { email, voterAddress } = schema.parse(req.body);

    if (seenEmails.has(email)) {
      return res.status(400).json({ error: "Email already used" });
    }

    const chainId = (await provider.getNetwork()).chainId;
    // digest = keccak256("VOTE", chainId, voterAddress)
    const digest = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes4","uint256","address"],
      ["0x564f5445", chainId, voterAddress]
    ));
    // Sign as an Ethereum Signed Message so the contract can recover it
    const signature = await wallet.signMessage(ethers.getBytes(digest));

    seenEmails.add(email);
    res.json({ signature });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Simple audit endpoint
app.get('/api/audit/latest', async (_req, res) => {
  try {
    const latest = await provider.getBlockNumber();
    const from = Math.max(latest - 5000, 0);
    const logs = await provider.getLogs({ address: VOTING_ADDRESS, fromBlock: from, toBlock: 'latest' });

    const iface = new ethers.Interface(votingAbi);
    const events = logs.map(l => {
      const ev = iface.parseLog(l);
      return { blockNumber: l.blockNumber, tx: l.transactionHash, event: ev.name, args: ev.args };
    });
    res.json({ fromBlock: from, toBlock: latest, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend ready on http://localhost:${PORT}`);
  console.log(`Contract: ${VOTING_ADDRESS}`);
});
