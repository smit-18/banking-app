"use client";

import React from "react";
import CountUp from "react-countup";

const AnimatedCounter = ({ amount }: { amount: number }) => {
	return (
		<div className="w-full">
			<CountUp prefix="$" decimal="." end={amount} decimals={2} />
		</div>
	);
};

export default AnimatedCounter;
