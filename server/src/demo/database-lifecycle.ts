const previewDatabasePattern = /^kondis-demo-pr-([1-9][0-9]*)$/;

export const runtimeRoleForDemoDatabase = (databaseName: string): string => {
  if (databaseName === 'kondis-demo') {
    return 'kondis_runtime';
  }
  const preview = previewDatabasePattern.exec(databaseName);
  if (preview) {
    return `kondis_demo_pr_${preview[1]}`;
  }
  throw new Error(`Refusing to manage non-demo database: ${databaseName}`);
};
