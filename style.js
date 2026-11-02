
// ==========================================
// 1. SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL =
    "https://hisoknujnrdvgbgwjwdm.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_qEktVTgKrP5sIzf-HeTMyg_734tagyd";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// 2. SWITCH BETWEEN SECTIONS
// ==========================================

function showPayment() {
    document.getElementById("paymentSection").classList.remove("hidden");
    document.getElementById("adminSection").classList.add("hidden");
    document.getElementById("dashboardSection").classList.add("hidden");
}

function showAdmin() {
    document.getElementById("paymentSection").classList.add("hidden");
    document.getElementById("adminSection").classList.remove("hidden");
    document.getElementById("dashboardSection").classList.add("hidden");
}


// ==========================================
// 3. CUSTOMER M-PESA PAYMENT
// ==========================================

let paymentInProgress = false;

document.getElementById("paymentForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        if (paymentInProgress) return;

        const phone = document.getElementById("phone").value.trim();

        const amount = Number(
            document.getElementById("amount").value
        );

        const message = document.getElementById("message");
        const button = document.getElementById("paymentButton");

        if (!/^(07|01)\d{8}$/.test(phone)) {
            message.className = "error";
            message.innerText = "Enter a valid Kenyan phone number.";
            return;
        }

        if (
            !Number.isSafeInteger(amount) ||
            amount < 1 ||
            amount > 150000
        ) {
            message.className = "error";
            message.innerText =
                "Enter an amount between KSh 1 and KSh 150,000.";
            return;
        }

        paymentInProgress = true;

        button.disabled = true;
        button.innerText = "Sending Prompt...";

        message.className = "waiting";
        message.innerText = "Connecting to M-PESA...";

        try {

            const { data, error } =
                await supabaseClient.functions.invoke(
                    "Mpesa-push",
                    {
                        body: {
                            phone: phone,
                            amount: amount
                        }
                    }
                );

            if (error) throw error;

            if (!data || !data.success) {
                throw new Error(
                    data?.message || "Unable to send payment prompt."
                );
            }

            const checkoutID = data.checkout_request_id;

            if (!checkoutID) {
                throw new Error("Missing M-PESA payment reference.");
            }

            message.className = "waiting";

            message.innerHTML = `
                <strong>M-PESA prompt sent!</strong><br>
                Check your phone ${phone}.<br>
                Enter your M-PESA PIN.<br><br>
                Waiting for confirmation...
            `;

            button.innerText = "Waiting for Payment";

            let completed = false;

            for (let i = 0; i < 40; i++) {

                await new Promise(resolve =>
                    setTimeout(resolve, 3000)
                );

                const {
                    data: payment,
                    error: checkError
                } = await supabaseClient
                    .from("payments")
                    .select("status, mpesa_receipt_number")
                    .eq("checkout_request_id", checkoutID)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (!payment) continue;

                if (payment.status === "Paid") {

                    message.className = "success";

                    message.innerHTML = `
                        <strong>✓ PAYMENT SUCCESSFUL!</strong><br>
                        Amount: KSh ${amount.toLocaleString()}<br>
                        Receipt: ${
                            payment.mpesa_receipt_number || "Confirmed"
                        }
                    `;

                    completed = true;
                    break;
                }

                if (payment.status === "Failed") {

                    message.className = "error";

                    message.innerText =
                        "Payment unsuccessful. Please try again.";

                    completed = true;
                    break;
                }
            }

            if (!completed) {

                message.className = "waiting";

                message.innerText =
                    "Confirmation is taking longer than expected. " +
                    "Check your M-PESA messages before trying again.";
            }

        } catch(error) {

            console.error(error);

            message.className = "error";

            message.innerText =
                error.message || "Payment request failed.";

        } finally {

            paymentInProgress = false;

            button.disabled = false;
            button.innerText = "Prompt Payment";
        }
    }
);


// ==========================================
// 4. ADMIN EMAIL AND PASSWORD LOGIN
// ==========================================

document.getElementById("adminLoginForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const email =
            document.getElementById("adminEmail").value.trim();

        const password =
            document.getElementById("adminPassword").value;

        const message =
            document.getElementById("adminMessage");

        const button =
            document.getElementById("loginButton");

        button.disabled = true;
        button.innerText = "Logging in...";

        message.className = "waiting";
        message.innerText = "Verifying administrator details...";

        try {

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            const user = data.user;

            // Check administrator role assigned securely
            // through Supabase Auth app_metadata.

            if (user.app_metadata?.role !== "admin") {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Access denied. This account is not an administrator."
                );
            }

            message.innerText = "";

            document.getElementById("adminSection")
                .classList.add("hidden");

            document.getElementById("paymentSection")
                .classList.add("hidden");

            document.getElementById("dashboardSection")
                .classList.remove("hidden");

            document.getElementById("adminWelcome").innerText =
                "Logged in as: " + user.email;

            await loadPayments();

        } catch(error) {

            console.error(error);

            message.className = "error";
            message.innerText =
                error.message || "Invalid email or password.";

        } finally {

            button.disabled = false;
            button.innerText = "Login to Dashboard";
        }
    }
);


// ==========================================
// 5. LOAD PAYMENT RECORDS
// ==========================================

async function loadPayments() {

    const table = document.getElementById("paymentsTable");

    const recordsMessage =
        document.getElementById("recordsMessage");

    table.innerHTML = "";

    recordsMessage.className = "waiting";
    recordsMessage.innerText = "Loading payment records...";

    try {

        const { data: sessionData } =
            await supabaseClient.auth.getSession();

        const user = sessionData.session?.user;

        if (!user || user.app_metadata?.role !== "admin") {
            throw new Error("Administrator login required.");
        }

        const { data, error } = await supabaseClient
            .from("payments")
            .select(`
                phone,
                amount,
                status,
                mpesa_receipt_number,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {

            recordsMessage.className = "";
            recordsMessage.innerText = "No payment records found.";

            return;
        }

        recordsMessage.className = "success";
        recordsMessage.innerText =
            "Total payment records: " + data.length;

        data.forEach(payment => {

            const row = document.createElement("tr");

            const values = [
                payment.phone ?? "-",
                payment.amount == null
                    ? "-"
                    : "KSh " + Number(payment.amount).toLocaleString(),
                payment.status ?? "-",
                payment.mpesa_receipt_number ?? "-",
                payment.created_at
                    ? new Date(payment.created_at).toLocaleString()
                    : "-"
            ];

            values.forEach((value, index) => {

                const cell = document.createElement("td");

                cell.textContent = value;

                if (index === 2) {

                    if (value === "Paid") {
                        cell.className = "paid";
                    }

                    if (value === "Failed") {
                        cell.className = "failed";
                    }
                }

                row.appendChild(cell);
            });

            table.appendChild(row);
        });

    } catch(error) {

        console.error(error);

        recordsMessage.className = "error";
        recordsMessage.innerText =
            error.message || "Could not load payment records.";
    }
}


// ==========================================
// 6. ADMIN LOGOUT
// ==========================================

async function adminLogout() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Could not log out. Please try again.");
        return;
    }

    document.getElementById("dashboardSection")
        .classList.add("hidden");

    document.getElementById("adminSection")
        .classList.remove("hidden");

    document.getElementById("adminLoginForm").reset();

    document.getElementById("adminMessage").className = "";
    document.getElementById("adminMessage").innerText = "";

    document.getElementById("paymentsTable").innerHTML = "";

}
