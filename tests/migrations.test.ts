// Contract tests over the migration SQL as TEXT.
//
// These files are inert source: none has been executed, and nothing in this
// repository may run them. That makes a text-level contract the only automated
// guard available, and it is worth having — a column present in the INSERT list
// but absent from the table, or a VALUES entry that has drifted out of
// alignment with its column, is silent until it corrupts production data.
//
// These tests connect to nothing and execute no SQL.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function migration(name: string): string {
  return readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
}

const GOVERNANCE = migration("20260802_02_submissions_result_governance.sql");
const RPC = migration("20260802_03_score_result_insert_rpc.sql");

const ORIGINAL_WEIGHTS = [
  "original_bodyweight",
  "original_bench",
  "original_squat",
  "original_deadlift",
] as const;

describe("governance migration: original weight columns", () => {
  for (const column of ORIGINAL_WEIGHTS) {
    it(`adds ${column} as a nullable double precision column`, () => {
      assert.match(
        GOVERNANCE,
        new RegExp(`ADD COLUMN IF NOT EXISTS ${column} double precision`),
      );
      // No NOT NULL and no DEFAULT: an existing row must stay valid untouched.
      assert.equal(
        new RegExp(`${column} double precision[^,]*(NOT NULL|DEFAULT)`).test(
          GOVERNANCE,
        ),
        false,
        `${column} must not backfill or constrain legacy rows`,
      );
    });

    it(`constrains ${column} without assuming kilograms`, () => {
      const constraint = new RegExp(
        `\\$chk\\$${column} IS NULL OR \\(${column} > 0 AND ${column} <= (\\d+)\\)\\$chk\\$`,
      );
      const match = GOVERNANCE.match(constraint);

      assert.ok(match, `${column} needs a NULL-tolerant positivity check`);
      // The ceiling exists to reject NaN/Infinity, not to re-validate the
      // athlete. It must sit above any plausible pound value, since the kg
      // bounds (bodyweight <= 181) would reject a legitimate 198 lb entry.
      assert.ok(
        Number(match[1]) > 1001,
        `${column} ceiling must not encode kilogram bounds`,
      );
    });
  }

  it("requires the full original set on a governed row", () => {
    const check = GOVERNANCE.match(
      /'submissions_governed_row_complete',\s*\$chk\$([\s\S]*?)\$chk\$/,
    );
    assert.ok(check, "governed-row completeness check is missing");
    const expression = check[1];

    for (const column of [...ORIGINAL_WEIGHTS, "original_unit_system"]) {
      assert.match(
        expression,
        new RegExp(`${column}\\s+IS NOT NULL`),
        `${column} must be required on a governed row`,
      );
    }

    // Existing requirements must survive.
    for (const column of [
      "score_version",
      "calculated_at",
      "visibility",
      "idempotency_key",
      "request_fingerprint",
      "dataset_kind",
      "dataset_label",
    ]) {
      assert.match(expression, new RegExp(`${column}\\s+IS NOT NULL`));
    }

    // ...and legacy rows must remain exempt, or the migration breaks the table.
    assert.match(expression, /^dataset_version_id IS NULL OR/);
  });

  it("keeps the pre-existing original_* fields", () => {
    for (const column of [
      "original_unit_system text",
      "original_run_distance text",
      "original_run_seconds integer",
    ]) {
      assert.ok(
        GOVERNANCE.includes(`ADD COLUMN IF NOT EXISTS ${column}`),
        `${column} must be preserved`,
      );
    }
  });

  it("stays additive", () => {
    // No destructive verb may enter this file. (DROP POLICY IF EXISTS is the
    // documented exception: it precedes the CREATE POLICY that replaces it.)
    const destructive = GOVERNANCE.replace(
      /DROP POLICY IF EXISTS submissions_hide_non_public ON public\.submissions;/,
      "",
    );
    for (const verb of [
      "DROP TABLE",
      "DROP COLUMN",
      "TRUNCATE",
      "DELETE FROM",
      "ALTER COLUMN provenance TYPE",
    ]) {
      assert.equal(destructive.includes(verb), false, `${verb} must not appear`);
    }
  });
});

describe("governance migration: submissions write privileges", () => {
  /** Every role that a browser can reach with a publishable/anon key. */
  const PUBLIC_ROLES = ["PUBLIC", "anon", "authenticated"] as const;

  for (const role of PUBLIC_ROLES) {
    it(`revokes INSERT, UPDATE and DELETE from ${role}`, () => {
      // The section 5 policy is FOR SELECT only, so grants are the only thing
      // standing between the anon key and a forged or deleted result row.
      assert.match(
        GOVERNANCE,
        new RegExp(
          `REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.submissions FROM ${role};`,
        ),
        `${role} must not keep write privileges on public.submissions`,
      );
    });
  }

  it("leaves SELECT alone so the public leaderboard keeps working", () => {
    // app/rankings/page.tsx reads submissions with the publishable key.
    // Revoking SELECT here would empty the leaderboard, and the RESTRICTIVE
    // policy — not a grant — is what narrows which rows those reads return.
    assert.equal(
      /REVOKE[^;]*SELECT[^;]*ON TABLE public\.submissions/.test(GOVERNANCE),
      false,
      "SELECT must not be revoked from the public roles",
    );

    // ...and not by the back door either: REVOKE ALL takes SELECT with it
    // without ever naming it.
    assert.equal(
      /REVOKE\s+ALL[^;]*ON TABLE public\.submissions/.test(GOVERNANCE),
      false,
      "a blanket REVOKE ALL on submissions would also remove SELECT",
    );

    // Every REVOKE against submissions must name exactly the three write
    // privileges, so a fourth can never be added silently.
    const revokes =
      GOVERNANCE.match(/REVOKE [^;]*ON TABLE public\.submissions[^;]*;/g) ?? [];
    assert.equal(revokes.length, 3, "one REVOKE per public role, no more");
    for (const statement of revokes) {
      assert.match(statement, /REVOKE INSERT, UPDATE, DELETE ON TABLE/);
    }
  });

  it("keeps the required write privileges on service_role", () => {
    const grant = GOVERNANCE.match(
      /GRANT ([^;]*) ON TABLE public\.submissions TO service_role;/,
    );
    assert.ok(grant, "service_role needs an explicit grant on submissions");

    // POST /api/score persists through the SECURITY DEFINER RPC, but the
    // repository reads placement directly and the deprecated POST /api/submit
    // still inserts directly — both as service_role.
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(
        grant[1],
        new RegExp(`\\b${privilege}\\b`),
        `service_role must retain ${privilege}`,
      );
    }
  });

  it("hardens privileges without granting anything to a public role", () => {
    const grants = GOVERNANCE.match(/GRANT [^;]*;/g) ?? [];
    for (const statement of grants) {
      for (const role of PUBLIC_ROLES) {
        assert.equal(
          new RegExp(`TO [^;]*\\b${role}\\b`).test(statement),
          false,
          `no privilege may be granted to ${role}: ${statement}`,
        );
      }
    }
  });
});

describe("insert RPC: original weight persistence", () => {
  /** The INSERT column list and its VALUES list, as written. */
  const insert = RPC.match(
    /INSERT INTO public\.submissions \(([\s\S]*?)\)\s*VALUES \(([\s\S]*?)\)\s*ON CONFLICT/,
  );

  function splitTopLevel(list: string): string[] {
    const items: string[] = [];
    let depth = 0;
    let current = "";

    // Comments must go BEFORE the split: prose contains commas and brackets
    // that would otherwise be read as SQL structure.
    for (const char of list.replace(/--[^\n]*/g, "")) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) {
        items.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    items.push(current);

    return items.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  it("has an INSERT whose columns and values line up one to one", () => {
    assert.ok(insert, "could not locate the INSERT statement");
    const columns = splitTopLevel(insert[1]);
    const values = splitTopLevel(insert[2]);

    assert.equal(
      columns.length,
      values.length,
      "every column needs exactly one value, in order",
    );
  });

  for (const column of ORIGINAL_WEIGHTS) {
    it(`writes ${column} from the matching payload key`, () => {
      assert.ok(insert);
      const columns = splitTopLevel(insert[1]);
      const values = splitTopLevel(insert[2]);

      const index = columns.indexOf(column);
      assert.notEqual(index, -1, `${column} is missing from the INSERT`);

      // Positional mapping is the failure mode that matters here: a squat
      // written into the deadlift column passes every constraint silently.
      assert.match(
        values[index],
        new RegExp(`p_payload->>'${column}'`),
        `${column} is fed by the wrong payload key`,
      );
      assert.match(values[index], /::double precision/);
    });
  }

  it("returns the stored originals so a saved row can be verified", () => {
    const returned = RPC.match(/RETURN jsonb_build_object\(([\s\S]*?)\n  \);/);
    assert.ok(returned, "could not locate the returned object");

    for (const column of [...ORIGINAL_WEIGHTS, "original_unit_system"]) {
      assert.match(
        returned[1],
        new RegExp(`'${column}',\\s*v_row\\.${column}`),
        `${column} must come from the saved row`,
      );
    }
  });

  it("preserves the atomic idempotency contract", () => {
    // Same key + same fingerprint replays; same key + different fingerprint
    // raises P0409. Neither may be softened into an overwrite.
    assert.match(RPC, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
    assert.match(RPC, /v_row\.request_fingerprint IS DISTINCT FROM v_fingerprint/);
    assert.match(RPC, /ERRCODE = 'P0409'/);
    assert.match(RPC, /v_replayed := true/);

    // No UPDATE path exists anywhere in the function.
    assert.equal(/UPDATE public\.submissions/.test(RPC), false);
    assert.equal(/DO UPDATE/.test(RPC), false);
  });

  it("keeps the function service-role only", () => {
    assert.match(RPC, /SECURITY DEFINER/);
    assert.match(RPC, /SET search_path = public, pg_temp/);
    assert.match(
      RPC,
      /REVOKE ALL ON FUNCTION public\.score_result_insert\(jsonb\) FROM anon, authenticated;/,
    );
    assert.match(
      RPC,
      /GRANT EXECUTE ON FUNCTION public\.score_result_insert\(jsonb\) TO service_role;/,
    );
  });
});
