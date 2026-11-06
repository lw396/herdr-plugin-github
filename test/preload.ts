// Herdr's `herdr` module exists only inside Herdr: under Bun it is test/fake-herdr.ts.
import { mock } from "bun:test";
import * as fake from "./fake-herdr.ts";

mock.module("herdr", () => fake);
