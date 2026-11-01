
// ===================================
// 1. SUPABASE CONNECTION
// ===================================

const SUPABASE_URL =
    "https://hisoknujnrdvgbgwjwdm.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_qEktVTgKrP5sIzf-HeTMyg_734tagyd";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ===================================
// 2. PAYMENT FUNCTION
// ===================================

let paymentInProgress = false;

document.getElementById("paymentForm").addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        if (paymentInProgress) return;

        const phone = document.getElementById("phone").value.trim();
        const amount = Number(
            document.getElementById("amount").value
        );

        const message = document.getElementById("message");
        const button = document.getElementById("paymentButton");

        // Validate phone number
        if (!/^(07|01)\d{8}$/.test(phone)) {
            message.className = "error";
            message.innerText =
                "Enter a valid Kenyan phone number.";
            return;
        }

        // Validate amount
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
        message.innerText =
            "Connecting to M-PESA. Please wait...";

        try {

            // ===================================
            // 3. SEND STK PUSH REQUEST
            // ===================================

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

            if (error) {
                console.error("Supabase function error:", error);
                throw new Error(
                    error.message ||
                    "Could not connect to the payment server."
                );
            }

            if (!data || !data.success) {
                throw new Error(
                    data?.message ||
                    "Unable to send payment prompt."
                );
            }

            // ===================================
            // 4. GET CHECKOUT REFERENCE
            // ===================================

            const checkoutID = data.checkout_request_id;

            if (!checkoutID) {
                throw new Error(
                    "Missing payment reference from Safaricom."
                );
            }

            // ===================================
            // 5. DISPLAY STK PUSH MESSAGE
            // ===================================

            message.className = "waiting";

            message.innerHTML = `
                <strong>M-PESA prompt sent!</strong><br>
                Check your phone ${phone}.<br>
                Enter your M-PESA PIN.<br><br>
                Waiting for payment confirmation...
            `;

            button.innerText = "Waiting for Payment";

            // ===================================
            // 6. CHECK PAYMENT STATUS
            // ===================================

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

                if (checkError) {
                    console.error(
                        "Payment status error:",
                        checkError
                    );

                    throw new Error(
                        "Payment was requested, but confirmation could not be checked. Please check your M-PESA messages."
                    );
                }

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
                        "Payment was unsuccessful. Please try again.";

                    completed = true;
                    break;
                }
            }

            // ===================================
            // 7. PAYMENT TIMEOUT
            // ===================================

            if (!completed) {

                message.className = "waiting";

                message.innerText =
                    "Confirmation is taking longer than expected. " +
                    "Check your M-PESA messages before trying again.";
            }

        } catch (error) {

            console.error("Payment error:", error);

            message.className = "error";

            message.innerText =
                error.message ||
                "Payment request failed. Please try again.";

        } finally {

            paymentInProgress = false;

            button.disabled = false;
            button.innerText = "Prompt Payment";
        }

    }
);
