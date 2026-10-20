const autoToggleAds = (ads) => {
  const now = new Date();
  return ads.map(ad => {
    const start = new Date(ad.startDate);
    const end = new Date(ad.endDate);
    const shouldBeActive = start <= now && now <= end;
    return { ...ad, active: shouldBeActive };
  });
};

const getTimeUntil = (date, currentTime = new Date()) => {
  // Ensure currentTime is a Date object
  const now = currentTime instanceof Date ? currentTime : new Date();
  if (isNaN(now.getTime())) {
    return 'Invalid current time';
  }

  // Handle date input (string or Date object)
  const targetDate = date instanceof Date ? date : new Date(date);
  if (isNaN(targetDate.getTime())) {
    return 'Invalid date';
  }

  // Calculate time difference in milliseconds
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) {
    return 'Past due';
  }

  // Convert to seconds, minutes, hours, days
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // Return human-readable time difference
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
};

module.exports = { autoToggleAds, getTimeUntil };
