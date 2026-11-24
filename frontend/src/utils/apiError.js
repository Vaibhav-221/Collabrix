export function getApiErrorMessage(error) {
  if (error?.response?.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (error?.response?.status === 409) {
    return error.response.data?.error || "An account with those details already exists.";
  }
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  if (error?.code === "ERR_NETWORK") {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
