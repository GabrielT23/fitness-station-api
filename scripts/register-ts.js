// Preloaded by `npm run openapi`. Registers ts-node with the Nest Swagger compiler
// plugin, so DTO metadata is introspected the same way `nest build` does it,
// and resolves the tsconfig path aliases (@modules, @config, ...).
require('ts-node').register({
  transformers: (program) => ({
    before: [require('@nestjs/swagger/plugin').before({}, program)],
  }),
});
require('tsconfig-paths').register();
