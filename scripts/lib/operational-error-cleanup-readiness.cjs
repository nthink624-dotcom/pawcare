function isOperationalErrorCleanupScheduled(productionReadback, localImplementation) {
  const scheduledReadback = productionReadback?.scheduledJobReadback;
  const expectedRoute = localImplementation?.route;
  const expectedSchedule = localImplementation?.scheduleUtc;

  if (scheduledReadback?.globalCronJobsEnabled !== true ||
      scheduledReadback?.operationalErrorCleanupConfigured !== true ||
      !Array.isArray(scheduledReadback?.productionJobs) ||
      typeof expectedRoute !== "string" ||
      typeof expectedSchedule !== "string") {
    return false;
  }

  return scheduledReadback.productionJobs.some((job) =>
    job?.path === expectedRoute && job?.scheduleUtc === expectedSchedule,
  );
}

module.exports = { isOperationalErrorCleanupScheduled };
