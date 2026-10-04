import { API_URL } from '../config';

// Temporary helper to get token (replace with your actual token retrieval logic later)
const getToken = () => {
  // return await AsyncStorage.getItem('token');
  return 'dummy_token'; // Placeholder
};

export const getPolicies = async () => {
  try {
    const response = await fetch(`${API_URL}/policies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${await getToken()}` // Uncomment when auth is ready
      },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error fetching policies');
    return data;
  } catch (error) {
    console.error('getPolicies Error:', error);
    throw error;
  }
};

export const updatePolicy = async (policyData: any) => {
  try {
    const response = await fetch(`${API_URL}/policies`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${await getToken()}` // Uncomment when auth is ready
      },
      body: JSON.stringify(policyData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error updating policies');
    return data;
  } catch (error) {
    console.error('updatePolicy Error:', error);
    throw error;
  }
};
