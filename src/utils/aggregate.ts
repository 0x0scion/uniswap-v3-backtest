interface TimeSeries {
  value: number;
  timestamp: number | string;
}

// Calculate an average of values over the specified periods
export const aggregate = (series: TimeSeries[], periodDurationInMs: number) => {
  const start = new Date(series[0].timestamp);
  let iterator = new Date(
    new Date(start.setUTCHours(0, 0, 0, 0) + periodDurationInMs)
  );
  const averageByPeriod: any[] = [];
  let timestamp: Date = iterator;
  let sum = 0,
    count = 0,
    point,
    t;

  // Do nothing if there's nothing to sum
  if (!series || series.length === 0) {
    return [];
  }

  for (let i = 0; i < series.length; i++) {
    point = series[i];
    t = point.timestamp;

    // Account for periods with no data at all
    while (t >= iterator) {
      averageByPeriod.push({
        timestamp: timestamp.getTime() - periodDurationInMs,
        value: count > 0 ? sum / count : 0,
      });
      timestamp = iterator;
      iterator = new Date(iterator.getTime() + periodDurationInMs);
      sum = 0;
      count = 0;
    }

    // Collect data
    sum += point.value;
    count += 1;
  }
  averageByPeriod.push({
    timestamp: timestamp.getTime(),
    value: count > 0 ? sum / count : 0,
  });

  return averageByPeriod;
};
