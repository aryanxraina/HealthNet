// Hands a generated file to the browser as a download
export const saveFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download after click() returns, so release the URL a moment later
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const todayStamp = () => new Date().toISOString().slice(0, 10);
