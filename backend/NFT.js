import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

const contractAddress = "YOUR_CONTRACT";
const abi = [ "function balanceOf(address owner) view returns (uint256)" ];

export default function useNFTCheck() {
  const { address } = useAccount();

  const checkNFT = async () => {
    if (!address) return false;

    const provider = new ethers.JsonRpcProvider("https://rpc-url");
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const balance = await contract.balanceOf(address);
    return balance > 0;
  };

  return { checkNFT };
}
const { checkNFT } = useNFTCheck();
const [hasNFT, setHasNFT] = useState(false);

useEffect(() => {
  async function run() {
    const result = await checkNFT();
    setHasNFT(result);
  }
  run();
}, []);

return (
  <>
    {hasNFT ? (
      <button className="btn">Activate SIM</button>
    ) : (
      <button className="btn">Buy SIM NFT</button>
    )}
  </>
);
