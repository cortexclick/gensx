import { Command } from "commander";

import { login } from "./commands/login";

const program = new Command()
  .name("gensx")
  .description("CLI tool for getting started with GenSX")
  .version("0.1.0");

program.command("login").description("Login to GenSX").action(login);

program.parse();
