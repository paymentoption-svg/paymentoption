

const SUPABASE_URL = "https://hisoknujnrdvgbgwjwdm.supabase.co";

const SUPABASE_KEY = "sb_publishable_qEktVTgKrP5sIzf-HeTMyg_734tagyd";

// Connect to Supabase
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Get website elements
const phoneInput = document.getElementById("phone");
const amountInput = document.getElementById("amount");
const paymentButton = document.getElementById("paymentButton");
const message = document.getElementById("message");

// Send payment request
paymentButton.addEventListener("click", async function (event) {
    event.preventDefault();

    const phone = phoneInput.value.trim();
    const amount = Number(amountInput.value);

    // Validate phone number
    if (!/^2547\d{8}$/.test(phone) && !/^2541\d{8}$/.test(phone)) {
        message.textContent =
            "Enter a valid Kenyan number starting with 254.";
        return;
    }

    // Validate amount
    if (!Number.isInteger(amount) || amount < 1) {
        message.textContent = "Enter a valid payment amount.";
        return;
    }

    paymentButton.disabled = true;
    paymentButton.textContent = "Sending request...";
    message.textContent = "Connecting to M-PESA...";

    try {
        // Call Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke(
            "mpesa-push",
            {
                body: {
                    phone: phone,
                    amount: amount
                }
            }
        );

        if (error) {
            throw new Error(error.message);
        }

        if (!data || !data.checkoutRequestID) {
            throw new Error(
                data?.error || "Could not start the payment request."
            );
        }

        const checkoutID = data.checkoutRequestID;

        message.textContent =
            "STK Push sent! Check your phone and enter your M-PESA PIN.";

        paymentButton.textContent = "Waiting for payment...";

        // Check payment status every 3 seconds for up to 2 minutes
        let paymentCompleted = false;

        for (let i = 0; i < 40; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));

            const { data: payment, error: checkError } =
                await supabaseClient
                    .from("payments")
                    .select("status, mpesa_receipt_number")
                    .eq("checkout_request_id", checkoutID)
                    .maybeSingle();

            if (checkError) {
                throw new Error(
                    "Could not check payment status. Check your Supabase permissions."
                );
            }

            if (payment?.status === "Paid") {
                message.textContent =
                    "PAYMENT SUCCESSFUL! Receipt: " +
                    (payment.mpesa_receipt_number || "Confirmed");

                paymentButton.textContent = "Payment Successful";
                paymentCompleted = true;
                break;
            }

            if (payment?.status === "Failed") {
                message.textContent =
                    "Payment failed. Please try again.";

                paymentCompleted = true;
                break;
            }
        }

        if (!paymentCompleted) {
            message.textContent =
                "Payment confirmation is taking longer than expected. " +
                "Check your M-PESA messages before trying again.";
        }

    } catch (error) {
        console.error("Payment error:", error);
        message.textContent = "Payment error: " + error.message;

    } finally {
        paymentButton.disabled = false;

        if (paymentButton.textContent !== "Payment Successful") {
            paymentButton.textContent = "Pay Now";
        }
    }
});

