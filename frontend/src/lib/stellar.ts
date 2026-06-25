/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  rpc,
  Address,
  scValToNative,
  nativeToScVal,
  TransactionBuilder,
  Networks as StellarNetworks,
  Operation,
  Transaction,
  Account,
  Asset,
} from '@stellar/stellar-sdk';

const networkPassphrase = StellarNetworks.TESTNET;
const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443';
export const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '';
export const streamContractAddress = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ADDRESS || '';

export const server = new rpc.Server(rpcUrl);

let initialized = false;
let kitModule: any = null;

async function getWalletKitModule() {
  if (typeof window === 'undefined') return null;
  if (!kitModule) {
    try {
      const kit = await import('@creit.tech/stellar-wallets-kit');
      const utils = await import('@creit.tech/stellar-wallets-kit/modules/utils');
      const types = await import('@creit.tech/stellar-wallets-kit/types');
      kitModule = {
        StellarWalletsKit: kit.StellarWalletsKit,
        defaultModules: utils.defaultModules,
        Networks: types.Networks,
      };
    } catch (err) {
      console.error('Failed to dynamically load stellar-wallets-kit:', err);
    }
  }
  return kitModule;
}

export async function initKit() {
  if (typeof window === 'undefined') return;
  if (!initialized) {
    const mod = await getWalletKitModule();
    if (mod) {
      mod.StellarWalletsKit.init({
        modules: mod.defaultModules(),
        network: mod.Networks.TESTNET,
      });
      initialized = true;
    }
  }
}

export async function connectWallet(): Promise<string> {
  await initKit();
  const mod = await getWalletKitModule();
  if (!mod) throw new Error('Wallet kit not available on server');
  try {
    const { address } = await mod.StellarWalletsKit.authModal();
    return address;
  } catch (error) {
    console.error('Wallet connection rejected or closed:', error);
    throw error;
  }
}

export async function getConnectedAddress(): Promise<string> {
  await initKit();
  const mod = await getWalletKitModule();
  if (!mod) return '';
  try {
    const { address } = await mod.StellarWalletsKit.getAddress();
    return address;
  } catch {
    return '';
  }
}

export async function disconnectWallet(): Promise<void> {
  await initKit();
  const mod = await getWalletKitModule();
  if (!mod) return;
  try {
    await mod.StellarWalletsKit.disconnect();
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}

export async function getTokenBalance(userAddress: string): Promise<number> {
  if (!userAddress || !tokenContractAddress) return 0;
  try {
    const operation = Operation.invokeContractFunction({
      contract: tokenContractAddress,
      function: 'balance',
      args: [new Address(userAddress).toScVal()],
    });

    const tx = new TransactionBuilder(
      new Account(userAddress, '0'),
      { networkPassphrase, fee: '100' }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const balanceVal = scValToNative(sim.result.retval);
      return Number(balanceVal);
    }
    return 0;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}

export interface StreamInfo {
  id: number;
  sender: string;
  recipient: string;
  deposit: number;
  startTime: number;
  duration: number;
  withdrawn: number;
  token: string;
}

export async function getStreamDetails(streamId: number): Promise<StreamInfo | null> {
  if (!streamContractAddress) return null;
  try {
    const dummyAccount = 'GAVAX3CT3G2XGKNXLMAP6R6IGRVQJHP6CBVOKNJVEWXONO2ZPQYPBXCM';
    const operation = Operation.invokeContractFunction({
      contract: streamContractAddress,
      function: 'get_stream',
      args: [nativeToScVal(BigInt(streamId), { type: 'u64' })],
    });

    const tx = new TransactionBuilder(
      new Account(dummyAccount, '0'),
      { networkPassphrase, fee: '100' }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const nativeObj = scValToNative(sim.result.retval);
      return {
        id: streamId,
        sender: nativeObj.sender,
        recipient: nativeObj.recipient,
        deposit: Number(nativeObj.deposit),
        startTime: Number(nativeObj.start_time),
        duration: Number(nativeObj.duration),
        withdrawn: Number(nativeObj.withdrawn),
        token: nativeObj.token,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching stream details for id ${streamId}:`, error);
    return null;
  }
}

export async function getVestedAmount(streamId: number): Promise<number> {
  if (!streamContractAddress) return 0;
  try {
    const dummyAccount = 'GAVAX3CT3G2XGKNXLMAP6R6IGRVQJHP6CBVOKNJVEWXONO2ZPQYPBXCM';
    const operation = Operation.invokeContractFunction({
      contract: streamContractAddress,
      function: 'vested_amount',
      args: [nativeToScVal(BigInt(streamId), { type: 'u64' })],
    });

    const tx = new TransactionBuilder(
      new Account(dummyAccount, '0'),
      { networkPassphrase, fee: '100' }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      return Number(scValToNative(sim.result.retval));
    }
    return 0;
  } catch (error) {
    console.error(`Error fetching vested amount for id ${streamId}:`, error);
    return 0;
  }
}

export async function listStreamsFor(userAddress: string): Promise<number[]> {
  if (!userAddress || !streamContractAddress) return [];
  try {
    const operation = Operation.invokeContractFunction({
      contract: streamContractAddress,
      function: 'list_streams_for',
      args: [new Address(userAddress).toScVal()],
    });

    const tx = new TransactionBuilder(
      new Account(userAddress, '0'),
      { networkPassphrase, fee: '100' }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const list = scValToNative(sim.result.retval);
      if (Array.isArray(list)) {
        return list.map(item => Number(item));
      }
    }
    return [];
  } catch (error) {
    console.error('Error listing streams:', error);
    return [];
  }
}

async function prepareAndSubmitTx(
  userAddress: string,
  operation: any
): Promise<string> {
  await initKit();
  const mod = await getWalletKitModule();
  if (!mod) throw new Error('Wallet kit not available');

  const sourceAccount = await server.getAccount(userAddress);
  let tx = new TransactionBuilder(sourceAccount, {
    networkPassphrase,
    fee: '100',
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  tx = await server.prepareTransaction(tx);

  const { signedTxXdr } = await mod.StellarWalletsKit.signTransaction(tx.toXDR(), {
    networkPassphrase,
    address: userAddress,
  });

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as Transaction;
  const submitResult = await server.sendTransaction(signedTx);

  if (submitResult.status === 'ERROR') {
    throw new Error((submitResult as any).errorResultXdr || (submitResult as any).errorResult?.result?.switch?.name || 'Transaction rejected by network');
  }

  let status: any = submitResult.status;
  const txHash = submitResult.hash;

  while (status === 'PENDING') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const txStatus = await server.getTransaction(txHash);
    status = txStatus.status;
    if (status === 'SUCCESS') {
      return txHash;
    }
    if (status === 'FAILED') {
      throw new Error('Transaction execution failed on chain');
    }
  }

  return txHash;
}

export async function createStream(
  sender: string,
  recipient: string,
  deposit: number,
  duration: number
): Promise<string> {
  const operation = Operation.invokeContractFunction({
    contract: streamContractAddress,
    function: 'create_stream',
    args: [
      new Address(sender).toScVal(),
      new Address(recipient).toScVal(),
      new Address(tokenContractAddress).toScVal(),
      nativeToScVal(BigInt(deposit), { type: 'i128' }),
      nativeToScVal(BigInt(duration), { type: 'u64' }),
    ],
  });

  return prepareAndSubmitTx(sender, operation);
}

export async function withdrawFromStream(
  recipient: string,
  streamId: number
): Promise<string> {
  const operation = Operation.invokeContractFunction({
    contract: streamContractAddress,
    function: 'withdraw',
    args: [nativeToScVal(BigInt(streamId), { type: 'u64' })],
  });

  return prepareAndSubmitTx(recipient, operation);
}

export async function cancelStream(
  sender: string,
  streamId: number
): Promise<string> {
  const operation = Operation.invokeContractFunction({
    contract: streamContractAddress,
    function: 'cancel_stream',
    args: [nativeToScVal(BigInt(streamId), { type: 'u64' })],
  });

  return prepareAndSubmitTx(sender, operation);
}

export async function addTrustline(userAddress: string): Promise<string> {
  await initKit();
  const mod = await getWalletKitModule();
  if (!mod) throw new Error('Wallet kit not available');

  const sourceAccount = await server.getAccount(userAddress);
  const issuerAddress = 'GAVAX3CT3G2XGKNXLMAP6R6IGRVQJHP6CBVOKNJVEWXONO2ZPQYPBXCM';
  const asset = new Asset('SV', issuerAddress);

  let tx = new TransactionBuilder(sourceAccount, {
    networkPassphrase,
    fee: '500',
  })
    .addOperation(Operation.changeTrust({ asset, limit: '1000000' }))
    .setTimeout(60)
    .build();

  tx = await server.prepareTransaction(tx);

  const { signedTxXdr } = await mod.StellarWalletsKit.signTransaction(tx.toXDR(), {
    networkPassphrase,
    address: userAddress,
  });

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as Transaction;
  const submitResult = await server.sendTransaction(signedTx);

  if (submitResult.status === 'ERROR') {
    throw new Error((submitResult as any).errorResultXdr || 'Transaction rejected by network');
  }

  let status: any = submitResult.status;
  const txHash = submitResult.hash;

  while (status === 'PENDING') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const txStatus = await server.getTransaction(txHash);
    status = txStatus.status;
    if (status === 'SUCCESS') {
      return txHash;
    }
    if (status === 'FAILED') {
      throw new Error('Trustline creation failed on chain');
    }
  }

  return txHash;
}
