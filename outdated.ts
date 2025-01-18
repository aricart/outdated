import { type Available, find, update } from "./deps.ts";
import { cli } from "@aricart/cobra";

const root = cli({
  use: "outdated -f (deno.json|package.json)",
  short: "list outdated dependencies",
  run: async (_cmd, _args, flags): Promise<number> => {
    flags.checkRequired();
    const files = flags.values<string>("file");

    for (const f of files) {
      const d = await Deno.readTextFile(f);
      const conf = JSON.parse(d);
      let available: Available[] = [];
      let dev: Available[] = [];
      if (conf.imports) {
        // deno
        available = await find(conf.imports);
      } else if (conf.dependencies) {
        available = await find(conf.dependencies, true);
        dev = await find(conf.devDependencies, true);
      }

      if (available.length === 0) {
        console.table(["no dependencies found"]);
      } else {
        console.table(available);
      }
      if (dev?.length) {
        console.table(dev);
      }
    }

    return 0;
  },
});

root.addFlag({
  name: "file",
  usage: "file to load - can be specified multiple times",
  short: "f",
  type: "string",
  required: true,
  persistent: true,
});

const updateCmd = root.addCommand({
  use: "update -f file [--only module]",
  short: "update outdated dependencies",
  run: async (_cmd, _args, flags): Promise<number> => {
    flags.checkRequired();
    const files = flags.values<string>("file");
    const filter = flags.values<string>("only") || [];

    for (const f of files) {
      const d = await Deno.readTextFile(f);
      const conf = JSON.parse(d);
      let available: Available[] = [];
      let dev: Available[] = [];
      if (conf.imports) {
        // deno
        available = await find(conf.imports);
        update(conf.imports, available, filter);
        const updated = available.filter((e) => {
          return e.updated;
        });
        if (updated.length) {
          console.table(updated);
        }
      } else if (conf.dependencies) {
        available = await find(conf.dependencies, true);
        update(conf.imports, available, filter);
        let updated = available.filter((e) => {
          return e.updated;
        });
        if (updated.length) {
          console.table(updated);
        }
        dev = await find(conf.devDependencies, true);
        update(conf.devDependencies, dev, filter);
        updated = dev.filter((e) => {
          return e.updated;
        });
        if (updated.length) {
          console.table(updated);
        }
      }
      await Deno.writeTextFile(f, JSON.stringify(conf, null, 2));
    }

    return 0;
  },
});

updateCmd.addFlag({
  name: "only",
  usage: "only update specified modules",
  type: "string",
});

root.execute();
