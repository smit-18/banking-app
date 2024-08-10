"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { authFormSchema } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CustomInput from "./CustomInput";
import SignUp from "@/app/(auth)/sign-up/page";
import { useRouter } from "next/navigation";
import { getLoggedInUser, signIn, signUp } from "@/lib/actions/user.actions";

const AuthForm = ({ type }: AuthFormProps) => {
    const router = useRouter();
	const [user, setUser] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const formSchema = authFormSchema(type);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (data: z.infer<typeof formSchema>) => {
		setIsLoading(true);

		try {
			if (type === "sign-up") {
				// Sign Up with Appwrite & create plaid token
				const newUser = await signUp(data);
				setUser(newUser);
			} else if (type === "sign-in") {
				const response = await signIn({
					email: data.email,
					password: data.password,
				});

                if (response) {
                    router.push("/");
                }
			}
		} catch (error) {
			console.log(error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="auth-form">
			<header className="flex flex-col gap-5 md:gap-8">
				<Link
					href="/"
					className="cursor-pointer flex items-center gap-1">
					<Image
						src="/icons/logo.svg"
						width={34}
						height={34}
						alt="Horizon logo"
					/>
					<h1 className="text-26 font-ibm-plex-serif font-bold text-black-1">
						Horizon
					</h1>
				</Link>

				<div className="flex flex-col gap-1 md:gap-3">
					<h1 className="text-24 lg:text-26 font-semibold text-gray-900">
						{user
							? "Link Account"
							: type === "sign-in"
							? "Sign In"
							: "Sign Up"}
						<p className="text-16 font-normal text-gray-600">
							{user
								? "Link your account to continue"
								: "Please enter your details."}
						</p>
					</h1>
				</div>
			</header>
			{user ? (
				<div className="flex flex-col gap-4">{/* PlaidLink */}</div>
			) : (
				<>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-8">
							{type === "sign-up" && (
								<>
									<div className="flex gap-4">
										<CustomInput
											control={form.control}
											name="firstName"
											placeholder=""
											label="First Name"
											type="text"
										/>
										<CustomInput
											control={form.control}
											name="lastName"
											placeholder=""
											label="Last Name"
											type="text"
										/>
									</div>
									<CustomInput
										control={form.control}
										name="address1"
										placeholder="Specific address"
										label="Address"
										type="address"
									/>
									<CustomInput
										control={form.control}
										name="city"
										placeholder="City"
										label="City"
										type="text"
									/>
									<div className="flex gap-4">
										<CustomInput
											control={form.control}
											name="state"
											placeholder="ex: NY"
											label="State"
											type="text"
										/>
										<CustomInput
											control={form.control}
											name="postalCode"
											placeholder="ex: 11101"
											label="Postal Code"
											type="text"
										/>
									</div>
									<div className="flex gap-4">
										<CustomInput
											control={form.control}
											name="dateOfBirth"
											placeholder="yyyy-mm-dd"
											label="Date of Birth"
											type="text"
										/>
										<CustomInput
											control={form.control}
											name="ssn"
											placeholder="ex: 1234"
											label="SSN"
											type="password"
										/>
									</div>
								</>
							)}

							<CustomInput
								control={form.control}
								name="email"
								placeholder="Enter your email"
								label="Email"
								type="text"
							/>
							<CustomInput
								control={form.control}
								name="password"
								placeholder="Enter your password"
								label="Password"
								type="password"
							/>

							<div className="flex flex-col gap-4">
								<Button
									className="form-btn"
									type="submit"
									disabled={isLoading}>
									{isLoading ? (
										<>
											<Loader2
												size={20}
												className="animate-spin"
											/>
											&nbsp; Loading...
										</>
									) : type === "sign-in" ? (
										"Sign In"
									) : (
										"Sign Up"
									)}
								</Button>
							</div>
						</form>
					</Form>

					<footer className="flex justify-center gap-1">
						<p className="text-14 font-normal text-gray-600">
							{type === "sign-in"
								? "Don't have an account?"
								: "Already have an account?"}
						</p>
						<Link
							className="form-link"
							href={type === "sign-in" ? "/sign-up" : "/sign-in"}>
							{type === "sign-in" ? "Sign Up" : "Sign In"}
						</Link>
					</footer>
				</>
			)}
		</section>
	);
};

export default AuthForm;
