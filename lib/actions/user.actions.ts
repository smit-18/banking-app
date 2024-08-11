"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ID, Query } from "node-appwrite";
import {
	CountryCode,
	ProcessorTokenCreateRequest,
	ProcessorTokenCreateRequestProcessorEnum,
	Products,
} from "plaid";
import { createAdminClient, createSessionClient } from "../appwrite";
import { plaidClient } from "../plaid";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const {
	APPWRITE_DATABASE_ID: DATABASE_ID,
	APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
	APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
	try {
		const { database } = await createAdminClient();

		const user = await database.listDocuments(
			DATABASE_ID!,
			USER_COLLECTION_ID!,
			[Query.equal("userId", [userId])]
		);

		if (user.total !== 1) return null;

		return parseStringify(user.documents[0]);
	} catch (error) {
		console.error("Error", error);
		return null;
	}
};

export const signIn = async ({ email, password }: SignInProps) => {
	try {
		const { account } = await createAdminClient();
		const session = await account.createEmailPasswordSession(
			email,
			password
		);

		cookies().set("appwrite-session", session.secret, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: true,
		});

		const user = await getUserInfo({ userId: session.userId });
		return parseStringify(user);
	} catch (error) {
		console.error("Error", error);
	}
};

export const signUp = async ({ password, ...userData }: SignUpParams) => {
	const { firstName, lastName, email } = userData;

	let newUserAccount;
	try {
		const { account, database } = await createAdminClient();

		newUserAccount = await account.create(
			ID.unique(),
			email,
			password,
			`${firstName} ${lastName}`
		);

		if (!newUserAccount) throw new Error("Error creating user");

		const dwollaCustomerUrl = await createDwollaCustomer({
			...userData,
			type: "personal",
		});

		if (!dwollaCustomerUrl)
			throw new Error("Error creating Dwolla customer");

		const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

		const newUser = await database.createDocument(
			DATABASE_ID!,
			USER_COLLECTION_ID!,
			ID.unique(),
			{
				...userData,
				userId: newUserAccount.$id,
				dwollaCustomerUrl,
				dwollaCustomerId,
			}
		);

		const session = await account.createEmailPasswordSession(
			email,
			password
		);

		cookies().set("appwrite-session", session.secret, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: true,
		});

		return parseStringify(newUser);
	} catch (error) {
		console.error("Error", error);
	}
};

export const getLoggedInUser = async () => {
	try {
		const { account } = await createSessionClient();
		const result = await account.get();
		const user = await getUserInfo({ userId: result.$id });
		return parseStringify(user);
	} catch (error) {
		return null;
	}
};

export const signOut = async () => {
	try {
		const { account } = await createSessionClient();
		cookies().delete("appwrite-session");
		await account.deleteSession("current");
	} catch (error) {
		return null;
	}
};

export const createLinkToken = async (user: User) => {
	try {
		const tokenParams = {
			user: {
				client_user_id: user.$id,
			},
			client_name: `${user.firstName} ${user.lastName}`,
			products: ["auth"] as Products[],
			language: "en",
			country_codes: ["US"] as CountryCode[],
		};

		const response = await plaidClient.linkTokenCreate(tokenParams);
		return parseStringify({ linkToken: response.data.link_token });
	} catch (error) {
		console.error("Error", error);
	}
};

export const createBankAccount = async ({
	userId,
	bankId,
	accountId,
	accessToken,
	fundingSourceUrl,
	shareableId,
}: createBankAccountProps) => {
	try {
		const { database } = await createAdminClient();
		const bankAccount = await database.createDocument(
			DATABASE_ID!,
			BANK_COLLECTION_ID!,
			ID.unique(),
			{
				userId,
				bankId,
				accountId,
				accessToken,
				fundingSourceUrl,
				shareableId,
			}
		);
		return parseStringify(bankAccount);
	} catch (error) {
		console.error("Error", error);
	}
};

export const exchangePublicToken = async ({
	publicToken,
	user,
}: exchangePublicTokenProps) => {
	try {
		// Exchange public token for access token and item ID
		const response = await plaidClient.itemPublicTokenExchange({
			public_token: publicToken,
		});

		const { access_token, item_id } = response.data;

		// Get account information from Plaid using the access token
		const accountsResponse = await plaidClient.accountsGet({
			access_token,
		});

		const accountData = accountsResponse.data.accounts[0];

		// create a processor token for Dwolla using the access token and account ID
		const request: ProcessorTokenCreateRequest = {
			access_token: access_token,
			account_id: accountData.account_id,
			processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
		};

		const processorTokenResponse = await plaidClient.processorTokenCreate(
			request
		);
		const processorToken = processorTokenResponse.data.processor_token;

		// create a funding source URL for the account using the Dwolla customer ID,
		// processor token, and bank name
		const fundingSourceUrl = await addFundingSource({
			dwollaCustomerId: user.dwollaCustomerId,
			processorToken,
			bankName: accountData.name,
		});

		// if the funding source URL is not created, throw an error
		if (!fundingSourceUrl) {
			throw new Error("Error creating funding source");
		}

		// create a bank account
		await createBankAccount({
			userId: user.$id,
			bankId: item_id,
			accountId: accountData.account_id,
			accessToken: access_token,
			fundingSourceUrl,
			shareableId: encryptId(accountData.account_id),
		});

		// Revalidate the path to reflect the changes
		revalidatePath("/");

		// return a success message
		return parseStringify({ publicTokenExchange: "complete" });
	} catch (error) {
		console.error("Error", error);
	}
};

export const getBanks = async ({ userId }: getBanksProps) => {
	try {
		const { database } = await createAdminClient();
		const banks = await database.listDocuments(
			DATABASE_ID!,
			BANK_COLLECTION_ID!,
			[Query.equal("userId", [userId])]
		);
		return parseStringify(banks.documents);
	} catch (error) {
		console.error("Error", error);
	}
};

// get specific bank from bank collection by document id
export const getBank = async ({ documentId }: getBankProps) => {
	try {
		const { database } = await createAdminClient();

		const bank = await database.listDocuments(
			DATABASE_ID!,
			BANK_COLLECTION_ID!,
			[Query.equal("$id", [documentId])]
		);

		if (bank.total !== 1) return null;

		return parseStringify(bank.documents[0]);
	} catch (error) {
		console.error("Error", error);
		return null;
	}
};
