export default ({ config }) => {
    if (process.env.BUDGET_ANDROID_PREVIEW !== '1') return config;

    return {
        ...config,
        name: 'Budget Mobile Preview',
        android: { ...config.android, package: 'com.hike12.budgetmobile.preview' },
        updates: { ...config.updates, enabled: false },
    };
};
