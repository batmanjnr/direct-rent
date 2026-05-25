import AsyncStorage from '@react-native-async-storage/async-storage';
let store = {};
export const setVerifyParams = (p) => {
  store = p || {};
  try {
    if (p) AsyncStorage.setItem('verify_pending', JSON.stringify(p));
    else AsyncStorage.removeItem('verify_pending');
  } catch (e) {
    console.warn('[verifyStore] AsyncStorage write failed', e);
  }
};

export const getVerifyParams = () => {
  try {
    // prefer in-memory
    if (store && Object.keys(store).length) return store;
    // fallback: try reading AsyncStorage synchronously via cached value is not possible, so return store and rely on VerifyEmail to read AsyncStorage explicitly if needed
    return store;
  } catch (e) {
    console.warn('[verifyStore] get failed', e);
    return store;
  }
};

export async function loadVerifyParamsFromStorage() {
  try {
    const raw = await AsyncStorage.getItem('verify_pending');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    store = parsed || {};
    return store;
  } catch (e) {
    console.warn('[verifyStore] load from AsyncStorage failed', e);
    return null;
  }
}
