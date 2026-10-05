const DATABASE_KEY = "cashin_transactions_v9";

const FREE_HOURS = 4;
const HOURLY_RATE = 1;

const MIDNIGHT_PENALTY = 2;

const HIGH_FIRST_MIDNIGHT = 50;
const HIGH_NEXT_MIDNIGHT = 30;

const VERY_HIGH_FIRST_MIDNIGHT = 100;
const VERY_HIGH_NEXT_MIDNIGHT = 50;

const MAX_CASH_IN = 10000;

function peso(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getTransactions() {
    return JSON.parse(localStorage.getItem(DATABASE_KEY)) || [];
}

function saveTransactions(transactions) {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(transactions));
}

function getBaseFee(amount) {
    if (amount >= 1 && amount <= 500) {
        return 5;
    }

    if (amount >= 501 && amount <= 1999) {
        return 10;
    }

    if (amount >= 2000 && amount <= 5000) {
        return 15;
    }

    if (amount >= 5001 && amount <= 9999) {
        return 35;
    }

    if (amount === 10000) {
        return 60;
    }

    return 0;
}

function countMidnights(startDate, endDate) {
    if (endDate <= startDate) {
        return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    let count = 0;

    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);

    while (midnight <= end) {
        count++;
        midnight.setDate(midnight.getDate() + 1);
    }

    return count;
}

function calculatePenalty(cashIn, cashInTime, paymentTime) {
    const start = new Date(cashInTime);
    const end = new Date(paymentTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
    }

    if (end <= start) {
        return {
            totalHours: 0,
            midnightCount: 0,
            dayPenalty: 0,
            chargeableHours: 0,
            hourPenalty: 0,
            latePenalty: 0
        };
    }

    const totalMilliseconds = end - start;
    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));

    const midnightCount = countMidnights(start, end);

    let dayPenalty = 0;
    let chargeableHours = 0;
    let hourPenalty = 0;
    let latePenalty = 0;

    if (cashIn < 100) {
        latePenalty = 0;
    } else if (cashIn >= 100 && cashIn <= 1999) {
        chargeableHours = Math.max(totalHours - FREE_HOURS, 0);

        hourPenalty = chargeableHours * HOURLY_RATE;

        dayPenalty = midnightCount * MIDNIGHT_PENALTY;

        latePenalty = dayPenalty + hourPenalty;
    } else if (cashIn >= 2000 && cashIn <= 4999) {
        if (midnightCount > 0) {
            dayPenalty =
                HIGH_FIRST_MIDNIGHT +
                (midnightCount - 1) * HIGH_NEXT_MIDNIGHT;
        }

        latePenalty = dayPenalty;
    } else if (cashIn >= 5000 && cashIn <= 10000) {
        if (midnightCount > 0) {
            dayPenalty =
                VERY_HIGH_FIRST_MIDNIGHT +
                (midnightCount - 1) * VERY_HIGH_NEXT_MIDNIGHT;
        }

        latePenalty = dayPenalty;
    }

    return {
        totalHours,
        midnightCount,
        dayPenalty,
        chargeableHours,
        hourPenalty,
        latePenalty
    };
}

function calculateTransaction(cashIn, cashInTime, paymentTime) {
    if (cashIn > MAX_CASH_IN) {
        throw new Error("No cash-in / no utang above ₱10,000.");
    }

    if (cashIn <= 0) {
        throw new Error("Cash-in amount must be greater than ₱0.");
    }

    const baseFee = getBaseFee(cashIn);

    const penalty = calculatePenalty(
        cashIn,
        cashInTime,
        paymentTime
    );

    if (!penalty) {
        throw new Error("Invalid date or time.");
    }

    const rawTotalFee = baseFee + penalty.latePenalty;

    const totalFee = Math.ceil(rawTotalFee / 5) * 5;

    const totalPay = cashIn + totalFee;

    return {
        cashIn,
        baseFee,
        midnightCount: penalty.midnightCount,
        dayPenalty: penalty.dayPenalty,
        totalHours: penalty.totalHours,
        chargeableHours: penalty.chargeableHours,
        hourPenalty: penalty.hourPenalty,
        latePenalty: penalty.latePenalty,
        totalFee,
        totalPay
    };
}

function addTransaction(transaction) {
    const transactions = getTransactions();

    transactions.push(transaction);

    saveTransactions(transactions);

    return transactions;
}

function deleteTransaction(index) {
    const transactions = getTransactions();

    if (index < 0 || index >= transactions.length) {
        return;
    }

    transactions.splice(index, 1);

    saveTransactions(transactions);
}

function clearTransactions() {
    localStorage.removeItem(DATABASE_KEY);
}

function hasUnsettledDebt() {
    const transactions = getTransactions();

    return transactions.some(transaction => {
        return transaction.settled === false;
    });
}

function formatDate(date) {
    return new Date(date).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function calculateAndSaveTransaction(
    customerName,
    cashIn,
    cashInTime,
    paymentTime,
    settled
) {
    const amount = Number(cashIn);

    if (!customerName || !customerName.trim()) {
        throw new Error("Customer name is required.");
    }

    if (amount > MAX_CASH_IN) {
        throw new Error("No cash-in / no utang above ₱10,000.");
    }

    const transactions = getTransactions();

    const hasPreviousUnsettled = transactions.some(
        transaction => transaction.settled === false
    );

    if (hasPreviousUnsettled) {
        throw new Error(
            "No Settlement, No Cash-In. Please settle the previous debt first."
        );
    }

    const result = calculateTransaction(
        amount,
        cashInTime,
        paymentTime
    );

    const transaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        customerName: customerName.trim(),
        cashIn: result.cashIn,
        cashInTime,
        paymentTime,
        totalHours: result.totalHours,
        baseFee: result.baseFee,
        midnightCount: result.midnightCount,
        dayPenalty: result.dayPenalty,
        chargeableHours: result.chargeableHours,
        hourPenalty: result.hourPenalty,
        latePenalty: result.latePenalty,
        totalFee: result.totalFee,
        totalPay: result.totalPay,
        settled: Boolean(settled)
    };

    transactions.push(transaction);

    saveTransactions(transactions);

    return transaction;
}
