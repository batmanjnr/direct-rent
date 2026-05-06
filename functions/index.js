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
