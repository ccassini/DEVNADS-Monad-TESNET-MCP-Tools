/**
 * Monad MCP Server
 * 
 * This file implements a Model Context Protocol (MCP) server
 * that interacts with the Monad blockchain testnet to check MON balances.
 */

// Import necessary dependencies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, formatUnits, http, createWalletClient, parseUnits, encodeFunctionData } from "viem";
import { monadTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Create a public client to interact with the Monad testnet
const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(),
});

const PRIVATE_KEY = "0x55f06ef0b162f094c7c55fcc29750f902fb6b0ca09fa3a0d26ad459def3c8ca0";
const senderAccount = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
    account: senderAccount,
    chain: monadTestnet,
    transport: http(),
});

// Router and DEX token addresses
const ROUTER_ADDRESS = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WMON = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const TOKEN_ADDRESSES = {
  USDC: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
  USDT: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
  DAK: "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
  CHOG: "0xE0590015A873bF326bd645c3E1266d4db41C4E6B",
  YAKI: "0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50"
};

// ABIs for interacting with tokens and router
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];

const ROUTER_ABI = [
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256[]" }]
  }
];

// Initialize the MCP server with a name, version, and capabilities
const server = new McpServer({
    name: "monad-mcp-server",
    version: "1.0.0",
    capabilities: [
        "Check wallet balances",
        "Monad network information",
        "Transaction details",
        "Transfer MON",
        "Apriori-mon stake",
        "Swap MON for tokens"
    ]
});

// Define a tool that gets the MON balance for a given address
server.tool(
    // Tool ID 
    "check-wallet-balances",
    // Description of what the tool does
    "Get MON balance for an address on Monad testnet",
    // Input schema
    {
        address: z.string().describe("Monad testnet address to check balance for"),
    },
    // Tool implementation
    async ({ address }) => {
        try {
            // Check MON balance for the input address
            const balance = await publicClient.getBalance({
                address: address as `0x${string}`,
            });

            // Return a human friendly message indicating the balance.
            return {
                content: [
                    {
                        type: "text",
                        text: `Balance for ${address}: ${formatUnits(balance, 18)} MON`,
                    },
                ],
            };
        } catch (error) {
            // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve balance for address: ${address}. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get Monad network information
server.tool(
    // Tool ID
    "monad-network-info",
    // Description of what the tool does
    "Get information about the Monad network",
    // Input schema (no inputs needed)
    {},
    // Tool implementation
    async () => {
        try {
            // Get the current block number
            const blockNumber = await publicClient.getBlockNumber();
            
            // Get chain ID
            const chainId = await publicClient.getChainId();

            // Get gas price
            const gasPrice = await publicClient.getGasPrice();

            return {
                content: [
                    {
                        type: "text",
                        text: `Monad Network Information:
- Network: Monad Testnet
- Chain ID: ${chainId}
- Current Block: ${blockNumber}
- Gas Price: ${formatUnits(gasPrice, 9)} Gwei
- RPC URL: ${monadTestnet.rpcUrls.default.http[0]}
- Native Currency: ${monadTestnet.nativeCurrency.name} (${monadTestnet.nativeCurrency.symbol})
- Block Explorer: ${monadTestnet.blockExplorers?.default.url || "Not available"}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve Monad network information. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get transaction details
server.tool(
    // Tool ID
    "transaction-details",
    // Description of what the tool does
    "Get details about a transaction on Monad testnet",
    // Input schema
    {
        hash: z.string().describe("Transaction hash to look up"),
    },
    // Tool implementation
    async ({ hash }) => {
        try {
            // Get transaction details
            const transaction = await publicClient.getTransaction({
                hash: hash as `0x${string}`,
            });

            // Get transaction receipt for more details
            const receipt = await publicClient.getTransactionReceipt({
                hash: hash as `0x${string}`,
            });

            // Format values for display
            const value = transaction.value ? formatUnits(transaction.value, 18) : "0";
            const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : "Unknown";
            const status = receipt.status === "success" ? "Success" : "Failed";
            
            // Format the output
            return {
                content: [
                    {
                        type: "text",
                        text: `Transaction Details for ${hash}:
- Status: ${status}
- Block Number: ${receipt.blockNumber}
- From: ${transaction.from}
- To: ${transaction.to || "Contract Creation"}
- Value: ${value} MON
- Gas Used: ${gasUsed}
- Gas Price: ${formatUnits(transaction.gasPrice || BigInt(0), 9)} Gwei
- Timestamp: ${new Date().toISOString()} (current server time)
${monadTestnet.blockExplorers?.default ? 
`- View on Explorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}` : ''}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve transaction details for hash: ${hash}. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to send MON tokens to an address
server.tool(
    "send-mon",
    "Send MON tokens to an address on Monad testnet",
    {
        to: z.string().describe("Recipient Monad testnet address"),
        amount: z.string().describe("Amount of MON to send (as a string, e.g. '0.1')"),
    },
    async ({ to, amount }) => {
        try {
            const value = parseUnits(amount, 18); // MON uses 18 decimals
            const hash = await walletClient.sendTransaction({
                to: to as `0x${string}`,
                value,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Sent ${amount} MON to ${to}. Transaction hash: ${hash}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to send MON. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Minimal ABI ve contract adresi
const minimalAbi = [
  {
    constant: true,
    inputs: [{ name: "", type: "address" }],
    name: "getPendingUnstakeRequests",
    outputs: [{ name: "", type: "uint256[]" }],
    type: "function"
  }
];
const contractAddress = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const gasLimitStake = 500000n;
const gasLimitUnstake = 800000n;
const gasLimitClaim = 800000n;

// --- UNIFIED APRIORI MON TOOL ---
server.tool(
  "apriori-mon-stake",
  "Apriori protocol functions for Monad: deposit, unstake, and redeem",
  {
    operation: z.enum(["deposit", "unstake", "redeem"]).describe("Operation type: deposit, unstake, or redeem"),
    amount: z.string().optional().describe("Amount in MON (required for deposit and unstake)"),
    requestId: z.string().optional().describe("Request ID (required for redeem)"),
  },
  async ({ operation, amount, requestId }) => {
    try {
      // Validate parameters based on operation
      if ((operation === "deposit" || operation === "unstake") && !amount) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Amount is required for ${operation} operation.`,
            },
          ],
        };
      }
      
      if (operation === "redeem" && !requestId) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Request ID is required for redeem operation.",
            },
          ],
        };
      }
      
      let data: string;
      let value = 0n;
      let gasLimit = 0n;
      let operationName = "";
      
      switch (operation) {
        case "deposit":
          // Deposit operation
          operationName = "Deposit";
          const depositValue = parseUnits(amount!, 18);
          value = depositValue;
          
          // Doğru function selector: 0x6e553f65
          const depositSelector = '0x6e553f65';
          
          // Viem ile hexadecimal pad ve dönüşüm işlemleri 
          const depositAmountHex = depositValue.toString(16).padStart(64, '0');
          const depositAddressHex = senderAccount.address.slice(2).padStart(64, '0');
          
          data = `${depositSelector}${depositAmountHex}${depositAddressHex}`;
          gasLimit = gasLimitStake;
          break;
          
        case "unstake":
          // Unstake operation
          operationName = "Unstake";
          const unstakeValue = parseUnits(amount!, 18);
          
          // Doğru function selector: 0x7d41c86e
          const unstakeSelector = '0x7d41c86e';
          
          // Viem ile hexadecimal pad ve dönüşüm işlemleri 
          const unstakeAmountHex = unstakeValue.toString(16).padStart(64, '0');
          const unstakeAddressHex1 = senderAccount.address.slice(2).padStart(64, '0');
          const unstakeAddressHex2 = senderAccount.address.slice(2).padStart(64, '0');
          
          data = `${unstakeSelector}${unstakeAmountHex}${unstakeAddressHex1}${unstakeAddressHex2}`;
          gasLimit = gasLimitUnstake;
          break;
          
        case "redeem":
          // Redeem operation
          operationName = "Redeem";
          
          // Doğru function selector: 0x492e47d2
          const redeemSelector = '0x492e47d2';
          
          // Viem ile hexadecimal pad ve dönüşüm işlemleri
          const offsetHex = '40'.padStart(64, '0');
          const addressHex = senderAccount.address.slice(2).padStart(64, '0');
          const flagHex = '01'.padStart(64, '0');
          const requestIdBigInt = BigInt(requestId!);
          const requestIdHex = requestIdBigInt.toString(16).padStart(64, '0');
          
          data = `${redeemSelector}${offsetHex}${addressHex}${flagHex}${requestIdHex}`;
          gasLimit = gasLimitClaim;
          break;
          
        default:
          return {
            content: [
              {
                type: "text",
                text: `Invalid operation: ${operation}`,
              },
            ],
          };
      }
      
      const hash = await walletClient.sendTransaction({
        to: contractAddress,
        data: data as `0x${string}`,
        value,
        gas: gasLimit,
      });
      
      // Success message based on operation
      let successMessage = "";
      switch (operation) {
        case "deposit":
          successMessage = `Deposited ${amount} MON`;
          break;
        case "unstake":
          successMessage = `Unstaked ${amount} MON`;
          break;
        case "redeem":
          successMessage = `Redeemed MON for request id ${requestId}`;
          break;
      }
      
      return {
        content: [
          {
            type: "text",
            text: `${operationName} operation successful: ${successMessage}. Tx: ${EXPLORER_URL}${hash}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Apriori ${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// --- SWAP MON TO TOKEN TOOL ---
server.tool(
  "swap-mon",
  "Swap MON for tokens using Monad DEX (Uniswap V2)",
  {
    tokenAddress: z.string().describe("Token address or symbol (e.g., 'USDC', 'USDT') to swap to"),
    monAmount: z.string().describe("Amount of MON to swap (as string, e.g. '0.1')"),
  },
  async ({ tokenAddress, monAmount }) => {
    try {
      // Check if input is a token symbol and convert to address if needed
      let finalTokenAddress = tokenAddress;
      if (tokenAddress.toUpperCase() in TOKEN_ADDRESSES) {
        finalTokenAddress = TOKEN_ADDRESSES[tokenAddress.toUpperCase() as keyof typeof TOKEN_ADDRESSES];
      }
      
      // Parse the MON amount
      const value = parseUnits(monAmount, 18);
      
      // Create the path array for the swap (MON → WMON → Token)
      const path = [WMON, finalTokenAddress];
      
      // Set deadline to 10 minutes from now
      const now = Math.floor(Date.now() / 1000);
      const deadline = now + 600;
      
      // Encode the swap function call
      const data = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swapExactETHForTokens",
        args: [0n, path, senderAccount.address, BigInt(deadline)],
      });

      // Send the transaction
      const hash = await walletClient.sendTransaction({
        to: ROUTER_ADDRESS as `0x${string}`,
        data,
        value,
        gas: 300000n,
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Swap transaction sent! Swapping ${monAmount} MON for tokens at ${finalTokenAddress}.\nTransaction Hash: ${hash}\nTx Explorer: ${EXPLORER_URL}${hash}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Swap failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Add tool for getting account transaction history
server.tool(
  "account-transaction-history",
  "View recent transactions for any Monad address (both sent and received)",
  {
    address: z.string().describe("Monad address to check transaction history for"),
    limit: z.number().default(10).describe("Maximum number of transactions to return (default: 10)"),
  },
  async ({ address, limit }) => {
    try {
      // Get all transactions where the address is from or to
      const sentTxs = await publicClient.getTransactionCount({
        address: address as `0x${string}`,
      });

      // Get the most recent block number to start searching from
      const latestBlock = await publicClient.getBlockNumber();
      
      // Format address for comparison (lowercase)
      const formattedAddress = address.toLowerCase();
      
      // Store found transactions
      const transactions: any[] = [];
      const processed = new Set<string>();
      
      // Search through recent blocks to find transactions involving this address
      // This is a simplified implementation - in production you'd want pagination and better search
      let currentBlock = latestBlock;
      const blocksToSearch = 10; // Limit blocks to search to avoid too much processing
      
      for (let i = 0; i < blocksToSearch && transactions.length < limit; i++) {
        try {
          const block = await publicClient.getBlock({
            blockNumber: currentBlock,
            includeTransactions: true,
          });
          
          // Process transactions in this block
          for (const tx of block.transactions) {
            // Skip if we've already processed this transaction or reached limit
            if (processed.has(tx.hash) || transactions.length >= limit) continue;
            
            // Check if transaction involves our address
            const txFrom = (tx.from as any).toLowerCase();
            const txTo = tx.to ? (tx.to as any).toLowerCase() : null;
            
            if (txFrom === formattedAddress || txTo === formattedAddress) {
              // Get receipt for status
              const receipt = await publicClient.getTransactionReceipt({
                hash: tx.hash,
              });
              
              // Add to our results
              transactions.push({
                hash: tx.hash,
                blockNumber: Number(block.number),
                from: tx.from,
                to: tx.to,
                value: tx.value ? formatUnits(tx.value, 18) + " MON" : "0 MON",
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                status: receipt.status,
                gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "Unknown"
              });
              
              processed.add(tx.hash);
            }
          }
          
          // Move to previous block
          currentBlock = currentBlock - 1n;
        } catch (blockError) {
          console.error(`Error processing block ${currentBlock}:`, blockError);
          currentBlock = currentBlock - 1n;
          continue;
        }
      }
      
      // Return formatted results
      return {
        content: [
          {
            type: "text",
            text: `Transaction History for ${address}:
            
Total Transactions Sent (Nonce): ${sentTxs}
Recent Transactions Found: ${transactions.length}

${transactions.map((tx, index) => `
${index + 1}. ${tx.hash}
   Block: ${tx.blockNumber}
   Time: ${tx.timestamp}
   From: ${tx.from}
   To: ${tx.to || "Contract Creation"}
   Value: ${tx.value}
   Status: ${tx.status}
   Gas Used: ${tx.gasUsed}
   ${monadTestnet.blockExplorers?.default ? `Explorer: ${monadTestnet.blockExplorers.default.url}/tx/${tx.hash}` : ''}
`).join('')}

Note: Results are limited to recent blocks. ${sentTxs > transactions.length ? `Only showing ${transactions.length} of ${sentTxs} total transactions.` : ''}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching transaction history: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Simplified chain statistics tool
server.tool(
  "chain-statistics",
  "Show network statistics for the Monad blockchain",
  {
    blocks: z.number().default(5).describe("Number of recent blocks to analyze (default: 5)"),
  },
  async ({ blocks }) => {
    try {
      // Get current block
      const latestBlock = await publicClient.getBlockNumber();
      
      // Stats to track
      let totalTransactions = 0;
      const uniqueAddresses = new Set<string>();
      
      // Process recent blocks (limited to a small number for performance)
      for (let i = 0; i < Math.min(blocks, 10); i++) {
        try {
          const blockNumber = latestBlock - BigInt(i);
          
          // Get basic block info first
          const blockInfo = await publicClient.getBlock({
            blockNumber,
          });
          
          // Then get transactions for this block
          const blockWithTxs = await publicClient.getBlock({
            blockNumber,
            includeTransactions: true,
          });
          
          // Count transactions
          const txCount = blockWithTxs.transactions.length;
          totalTransactions += txCount;
          
          // Add addresses to set
          blockWithTxs.transactions.forEach(tx => {
            // Add from address (always exists)
            uniqueAddresses.add(tx.from);
            
            // Add to address if it exists
            if (tx.to) {
              uniqueAddresses.add(tx.to);
            }
          });
        } catch (error) {
          console.error(`Error processing block:`, error);
        }
      }
      
      // Get other network info
      const chainId = await publicClient.getChainId();
      const gasPrice = await publicClient.getGasPrice();
      
      return {
        content: [
          {
            type: "text",
            text: `Monad Chain Statistics:

Network Information:
- Chain ID: ${chainId}
- Current Block: ${latestBlock}
- Current Gas Price: ${formatUnits(gasPrice, 9)} Gwei

Analysis of Last ${blocks} Blocks:
- Total Transactions: ${totalTransactions}
- Unique Addresses: ${uniqueAddresses.size}
- Average Transactions Per Block: ${(totalTransactions / blocks).toFixed(2)}

Note: These statistics are based on the last ${blocks} blocks.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching chain statistics: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Simplified smart contract reader
server.tool(
  "smart-contract-reader",
  "Read data from any contract function on Monad blockchain",
  {
    contractAddress: z.string().describe("Contract address to interact with"),
    functionName: z.string().describe("Name of the function to call"),
    functionInputs: z.string().default("[]").describe("Function inputs as JSON array (e.g. [123, \"0x123...\"])"),
    abiFragment: z.string().describe("ABI fragment for the function as JSON string"),
  },
  async ({ contractAddress, functionName, functionInputs, abiFragment }) => {
    try {
      // Parse the ABI fragment and inputs
      let parsedAbi;
      let parsedInputs;
      
      try {
        parsedAbi = JSON.parse(abiFragment);
        parsedInputs = JSON.parse(functionInputs);
      } catch (parseError) {
        return {
          content: [
            {
              type: "text",
              text: `Error parsing inputs: ${parseError instanceof Error ? parseError.message : String(parseError)}
              
Please provide valid JSON for the ABI and inputs.

Example ABI: [{"name":"balanceOf","type":"function","inputs":[{"name":"owner","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}]
Example inputs: ["0x1234..."]`,
            },
          ],
        };
      }
      
      // Normalize ABI to array if it's not already
      if (!Array.isArray(parsedAbi)) {
        parsedAbi = [parsedAbi];
      }
      
      // Call the contract function
      const result = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parsedAbi,
        functionName: functionName,
        args: parsedInputs,
      });
      
      // Handle different result types
      let formattedOutput = "";
      
      if (typeof result === 'bigint') {
        formattedOutput = `${(result as bigint).toString()} (decimal)\n${formatUnits(result, 18)} (assuming 18 decimals)`;
      } else if (Array.isArray(result)) {
        formattedOutput = result.map((item, index) => {
          if (typeof item === 'bigint') {
            return `[${index}]: ${(item as bigint).toString()} (decimal), ${formatUnits(item, 18)} (assuming 18 decimals)`;
          }
          return `[${index}]: ${item}`;
        }).join("\n");
      } else {
        formattedOutput = String(result);
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Contract Read Results:

Contract: ${contractAddress}
Function: ${functionName}
Inputs: ${JSON.stringify(parsedInputs)}

Result:
${formattedOutput}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading contract: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

/**
 * Main function to start the MCP server
 * Uses stdio for communication with LLM clients
 */
async function main() {
    // Create a transport layer using standard input/output
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    console.error("Monad MCP Server running on stdio");
}

// Start the server and handle any fatal errors
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
