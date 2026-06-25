#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub sender: Address,
    pub recipient: Address,
    pub deposit: i128,
    pub start_time: u64,
    pub duration: u64,
    pub withdrawn: i128,
    pub token: Address,
}

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        deposit: i128,
        duration: u64,
    ) -> u64 {
        sender.require_auth();
        if deposit <= 0 {
            panic!("deposit must be positive");
        }
        if duration <= 0 {
            panic!("duration must be positive");
        }

        let mut counter = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "counter"))
            .unwrap_or(0u64);
        counter += 1;
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "counter"), &counter);

        let stream = Stream {
            sender: sender.clone(),
            recipient: recipient.clone(),
            deposit,
            start_time: env.ledger().timestamp(),
            duration,
            withdrawn: 0,
            token: token.clone(),
        };

        env.storage().persistent().set(&counter, &stream);

        // Index the stream ID for the sender
        let mut sender_streams: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "sender_streams"), sender.clone()))
            .unwrap_or(Vec::new(&env));
        sender_streams.push_back(counter);
        env.storage().persistent().set(
            &(Symbol::new(&env, "sender_streams"), sender.clone()),
            &sender_streams,
        );

        // Index the stream ID for the recipient
        if sender != recipient {
            let mut recipient_streams: Vec<u64> = env
                .storage()
                .persistent()
                .get(&(Symbol::new(&env, "recipient_streams"), recipient.clone()))
                .unwrap_or(Vec::new(&env));
            recipient_streams.push_back(counter);
            env.storage().persistent().set(
                &(Symbol::new(&env, "recipient_streams"), recipient.clone()),
                &recipient_streams,
            );
        }

        // Perform inter-contract call to lock deposit
        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &deposit);

        env.events().publish(
            (
                Symbol::new(&env, "stream_created"),
                counter,
                sender,
                recipient,
            ),
            deposit,
        );

        counter
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        env.storage()
            .persistent()
            .get(&stream_id)
            .expect("stream not found")
    }

    pub fn vested_amount(env: Env, stream_id: u64) -> i128 {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&stream_id)
            .expect("stream not found");
        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(stream.start_time);

        if elapsed >= stream.duration {
            stream.deposit
        } else {
            stream.deposit * (elapsed as i128) / (stream.duration as i128)
        }
    }

    pub fn withdraw(env: Env, stream_id: u64) -> i128 {
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&stream_id)
            .expect("stream not found");
        stream.recipient.require_auth();

        let vested = Self::vested_amount(env.clone(), stream_id);
        let withdrawable = vested - stream.withdrawn;
        if withdrawable <= 0 {
            panic!("nothing to withdraw");
        }

        stream.withdrawn += withdrawable;
        env.storage().persistent().set(&stream_id, &stream);

        // Perform inter-contract transfer to recipient
        let token_client = soroban_sdk::token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.recipient,
            &withdrawable,
        );

        env.events().publish(
            (
                Symbol::new(&env, "withdrawal"),
                stream_id,
                stream.recipient.clone(),
            ),
            withdrawable,
        );

        withdrawable
    }

    pub fn cancel_stream(env: Env, stream_id: u64) {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&stream_id)
            .expect("stream not found");
        stream.sender.require_auth();

        let vested = Self::vested_amount(env.clone(), stream_id);
        let to_recipient = vested - stream.withdrawn;
        let to_sender = stream.deposit - vested;

        let token_client = soroban_sdk::token::Client::new(&env, &stream.token);

        if to_recipient > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.recipient,
                &to_recipient,
            );
        }

        if to_sender > 0 {
            token_client.transfer(&env.current_contract_address(), &stream.sender, &to_sender);
        }

        // Cancelled stream is updated so that deposit = vested and duration = elapsed
        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(stream.start_time);
        let mut updated_stream = stream.clone();
        updated_stream.deposit = vested;
        updated_stream.duration = elapsed.max(1);
        updated_stream.withdrawn = vested;
        env.storage().persistent().set(&stream_id, &updated_stream);

        env.events().publish(
            (
                Symbol::new(&env, "stream_cancelled"),
                stream_id,
                stream.sender.clone(),
            ),
            to_sender,
        );
    }

    pub fn list_streams_for(env: Env, address: Address) -> Vec<u64> {
        let sender_streams: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "sender_streams"), address.clone()))
            .unwrap_or(Vec::new(&env));
        let recipient_streams: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "recipient_streams"), address.clone()))
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        for id in sender_streams.iter() {
            result.push_back(id);
        }
        for id in recipient_streams.iter() {
            let mut duplicate = false;
            for r_id in result.iter() {
                if r_id == id {
                    duplicate = true;
                    break;
                }
            }
            if !duplicate {
                result.push_back(id);
            }
        }
        result
    }
}

mod test;
