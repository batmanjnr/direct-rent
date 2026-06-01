const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    const docRef = admin.firestore().doc(`users/${uid}`);
    try {
        await docRef.set({
            id: uid,
            email: user.email || null,
            firstName: user.displayName ? user.displayName.split(' ')[0] : null,
            lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : null,
            phoneNumber: user.phoneNumber || null,
            role: 'tenant',
            city: null,
            nin: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('createUserProfile: user doc created for', uid);
    } catch (e) {
        console.error('createUserProfile: failed to create user doc', e);
    }
});

// Callable function to send OTP via SMS (if Twilio configured) or return OTP in response for dev.
exports.sendOtpSms = functions.https.onCall(async (data, context) => {
    // data: { uid, phone }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Request not authenticated');
    }
    const uid = context.auth.uid;
    if (!data || !data.phone) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing phone number');
    }
    if (data.uid && data.uid !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }

    const phone = data.phone.trim();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));
    const docRef = admin.firestore().doc(`phone_verifications/${uid}`);

    try {
        await docRef.set({ phone, code: otp, createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt });
    } catch (e) {
        console.error('sendOtpSms: failed to write verification doc', e);
        throw new functions.https.HttpsError('internal', 'Failed to create verification request');
    }

    // If Twilio credentials are available, attempt to send SMS
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && fromNumber) {
        try {
            const twilio = require('twilio')(accountSid, authToken);
            await twilio.messages.create({ body: `Your DirectRent verification code: ${otp}`, from: fromNumber, to: phone });
            console.log('sendOtpSms: SMS sent to', phone);
            return { success: true };
        } catch (e) {
            console.error('sendOtpSms: Twilio send failed', e);
            // keep stored OTP but return an error so client can fallback
            throw new functions.https.HttpsError('internal', 'Failed to send SMS');
        }
    }

    // Twilio not configured — return OTP in response (development fallback)
    console.log('sendOtpSms: Twilio not configured, returning dev code');
    return { success: true, devCode: otp };
});
