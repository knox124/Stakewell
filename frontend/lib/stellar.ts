import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  rpc as SorobanRpc,
  nativeToScVal,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';
import {
  CONTRACT_STAKING,
  CONTRACT_REWARDS,
  CONTRACT_TOKEN,
  XLM_SAC_ADDRESS,
  NETWORK_PASSPHRASE,
  RPC_URL,
  HORIZON_URL,
} from './contracts';

export function getRpcServer() {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
}

export type TxResult =
  | { ok: true; hash: string; returnValue?: unknown }
  | { ok: false; error: string; cancelled?: boolean };

/** Build, simulate, sign, and submit a Soroban contract invocation. */
export async function invokeContract(
  contractAddress: string,
  method: string,
  args: xdr.ScVal[],
  signerPublicKey: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<TxResult> {
  if (!contractAddress) {
    return { ok: false, error: 'Contract address not configured. Check environment variables.' };
  }

  try {
    const server = getRpcServer();
    const account = await server.getAccount(signerPublicKey);

    const contract = new Contract(contractAddress);
    const operation = contract.call(method, ...args);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      return { ok: false, error: `Simulation failed: ${simResult.error}` };
    }

    if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
      return { ok: false, error: 'Simulation returned unexpected result' };
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    const xdrString = preparedTx.toXDR();

    let signedXdr: string;
    try {
      signedXdr = await signTransaction(xdrString);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes('cancel') ||
        msg.toLowerCase().includes('reject') ||
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('user')
      ) {
        return { ok: false, error: 'Transaction cancelled by user.', cancelled: true };
      }
      return { ok: false, error: `Signing failed: ${msg}` };
    }

    const submitResult = await server.sendTransaction(
      TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
    );

    if (submitResult.status === 'ERROR') {
      return {
        ok: false,
        error: `Submission error: ${submitResult.errorResult?.toXDR('base64') || 'unknown'}`,
      };
    }

    const hash = submitResult.hash;
    let attempts = 0;
    while (attempts < 20) {
      await sleep(1500);
      const status = await server.getTransaction(hash);
      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          ok: true,
          hash,
          returnValue: status.returnValue ? scValToNative(status.returnValue) : undefined,
        };
      }
      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        return { ok: false, error: 'Transaction failed on-chain.' };
      }
      attempts++;
    }
    return { ok: false, error: 'Transaction timed out waiting for confirmation.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Read a contract value via simulation (no state change). */
export async function readContract(
  contractAddress: string,
  method: string,
  args: xdr.ScVal[],
  callerPublicKey: string
): Promise<unknown> {
  if (!contractAddress || !callerPublicKey) return null;

  try {
    const server = getRpcServer();
    const account = await server.getAccount(callerPublicKey);
    const contract = new Contract(contractAddress);
    const operation = contract.call(method, ...args);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
      return scValToNative(result.result.retval);
    }
    return null;
  } catch {
    return null;
  }
}

export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

export function i128ToScVal(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch XLM balance via Horizon */
export async function fetchXLMBalance(publicKey: string): Promise<number> {
  try {
    const resp = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!resp.ok) return 0;
    const data = await resp.json();
    const native = (data.balances as Array<{ asset_type: string; balance: string }>)?.find(
      (b) => b.asset_type === 'native'
    );
    return native ? parseFloat(native.balance) : 0;
  } catch {
    return 0;
  }
}

/** Fetch recent contract events via RPC */
export async function fetchContractEvents(
  contractId: string,
  limit = 20
): Promise<ContractEvent[]> {
  try {
    const server = getRpcServer();
    const resp = await server.getEvents({
      startLedger: 1,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
        },
      ],
      limit,
    });
    return resp.events.map((e) => {
      const topicVal = e.topic[0];
      let typeName = 'event';
      try {
        typeName = scValToNative(topicVal) as string;
      } catch {}
      return {
        id: e.id,
        type: typeName,
        ledger: e.ledger,
        data: e.value ? scValToNative(e.value) : null,
      };
    });
  } catch {
    return [];
  }
}

export interface ContractEvent {
  id: string;
  type: string;
  ledger: number;
  data: unknown;
}
