import assert from "assert";
import fs from "fs";
import { mount, useState, useMemo, useEffect } from "./hooks-with-key.js";

function logSync(msg) {
  fs.writeSync(1, msg);
  fs.fsyncSync(1);
}

const tests = {
  "key useState set state is available on next render": () => {
    const log = [];
    let setter = undefined;
    const Component = () => {
      log.push("render");
      const [state, setState] = useState("a", 0);
      log.push(`state:${state}`);
      setter = setState;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render", "state:0"]);
    setter(999);
    assert.deepEqual(log, ["render", "state:0", "render", "state:999"]);
    unmount();
    assert.deepEqual(log, ["render", "state:0", "render", "state:999"]);
  },
  "key useState can manage two different pieces of state": () => {
    const log = [];
    let setterOne = undefined;
    let setterTwo = undefined;
    const Component = () => {
      const [one, setOne] = useState("a", 0);
      const [two, setTwo] = useState("b", "hi");
      log.push(`one:${one}`);
      log.push(`two:${two}`);
      setterOne = setOne;
      setterTwo = setTwo;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["one:0", "two:hi"]);
    setterOne(5);
    assert.deepEqual(log, ["one:0", "two:hi", "one:5", "two:hi"]);
    setterTwo("hello");
    assert.deepEqual(log, [
      "one:0",
      "two:hi",
      "one:5",
      "two:hi",
      "one:5",
      "two:hello",
    ]);
    unmount();
  },
  "key useState can persist unrelated state on next render": () => {
    const log = [];
    let setter = undefined;
    let unrelated = "hello";
    const Component = () => {
      log.push("render");
      const [state, setState] = useState("a", 0);
      const [unrelatedState] = useState("b", unrelated);
      log.push(`unrelated:${unrelatedState}`);
      setter = setState;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render", "unrelated:hello"]);
    unrelated = "world";
    setter(999);
    assert.deepEqual(log, [
      "render",
      "unrelated:hello",
      "render",
      "unrelated:hello",
    ]);
    unmount();
    assert.deepEqual(log, [
      "render",
      "unrelated:hello",
      "render",
      "unrelated:hello",
    ]);
  },
  "key useState can hold onto skipped state": () => {
    const log = [];
    let setter = undefined;
    let unrelated = "hello";
    const Component = () => {
      log.push("render");
      const [state, setState] = useState("a", 0);
      if (state) {
        const [unrelatedState] = useState("b", unrelated);
        log.push(`unrelated:${unrelatedState}`);
      }
      setter = setState;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render"]);
    unrelated = "first";
    setter(1);
    assert.deepEqual(log, ["render", "render", "unrelated:first"]);
    unrelated = "skipped";
    setter(0);
    assert.deepEqual(log, ["render", "render", "unrelated:first", "render"]);
    setter(1);
    assert.deepEqual(log, [
      "render",
      "render",
      "unrelated:first",
      "render",
      "render",
      "unrelated:first",
    ]);
    unmount();
    assert.deepEqual(log, [
      "render",
      "render",
      "unrelated:first",
      "render",
      "render",
      "unrelated:first",
    ]);
  },
  "key useState does not rerender if skipped state set": () => {
    const log = [];
    let setter = undefined;
    let unrelated = "hello";
    let unrelatedSetter = undefined;
    const Component = () => {
      log.push("render");
      const [state, setState] = useState("a", 0);
      if (state) {
        const [unrelatedState, setUnrelatedState] = useState("b", unrelated);
        log.push(`unrelated:${unrelatedState}`);
        unrelatedSetter = setUnrelatedState;
      }
      setter = setState;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render"]);
    unrelated = "first";
    setter(1);
    assert.deepEqual(log, ["render", "render", "unrelated:first"]);
    unrelated = "skipped";
    setter(0);
    assert.deepEqual(log, ["render", "render", "unrelated:first", "render"]);
    unrelatedSetter("danger");
    assert.deepEqual(log, ["render", "render", "unrelated:first", "render"]);
    setter(1);
    assert.deepEqual(log, [
      "render",
      "render",
      "unrelated:first",
      "render",
      "render",
      "unrelated:danger",
    ]);
  },
  "key useMemo does not recalculate function if dependencies are unchanged":
    () => {
      const log = [];
      let setter = undefined;
      let unrelatedSetter = undefined;
      let memoCalls = 0;
      const Component = () => {
        const [state, setState] = useState("a", [1, 2, 3, 4]);
        const [unrelatedState, setUnrelatedState] = useState("b", "hi");
        const sum = useMemo(
          "c",
          () => {
            memoCalls += 1;
            return state.reduce((acc, num) => num + acc, 0);
          },
          [state],
        );
        log.push(`sum:${sum}`);
        setter = setState;
        unrelatedSetter = setUnrelatedState;
      };
      const unmount = mount(Component);
      assert.equal(memoCalls, 1);
      assert.deepEqual(log, ["sum:10"]);
      unrelatedSetter("hello");
      assert.equal(memoCalls, 1);
      assert.deepEqual(log, ["sum:10", "sum:10"]);
      setter([1, 2, 3, 4, 5]);
      assert.equal(memoCalls, 2);
      assert.deepEqual(log, ["sum:10", "sum:10", "sum:15"]);
      unmount();
    },
  "key useEffect calls effect on mount and cleanup on unmount": () => {
    const log = [];
    const Component = () => {
      useEffect(
        "a",
        () => {
          log.push("mount");
          return () => {
            log.push("unmount");
          };
        },
        [],
      );
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["mount"]);
    unmount();
    assert.deepEqual(log, ["mount", "unmount"]);
  },
  "key useEffect calls effect when dependencies change": () => {
    const log = [];
    let oneSetter;
    let twoSetter;
    const Component = () => {
      log.push("render");
      const [stateOne, setStateOne] = useState("a", 0);
      const [stateTwo, setStateTwo] = useState("b", 0);
      useEffect(
        "c",
        () => {
          log.push(`one:${stateOne}`);
          return () => {
            log.push(`cleanup:${stateOne}`);
          };
        },
        [stateOne],
      );
      oneSetter = setStateOne;
      twoSetter = setStateTwo;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render", "one:0"]);
    oneSetter(1);
    assert.deepEqual(log, ["render", "one:0", "render", "cleanup:0", "one:1"]);
    twoSetter(2);
    assert.deepEqual(log, [
      "render",
      "one:0",
      "render",
      "cleanup:0",
      "one:1",
      "render",
    ]);
    twoSetter(3);
    assert.deepEqual(log, [
      "render",
      "one:0",
      "render",
      "cleanup:0",
      "one:1",
      "render",
      "render",
    ]);
    oneSetter(4);
    assert.deepEqual(log, [
      "render",
      "one:0",
      "render",
      "cleanup:0",
      "one:1",
      "render",
      "render",
      "render",
      "cleanup:1",
      "one:4",
    ]);
    unmount();
    assert.deepEqual(log, [
      "render",
      "one:0",
      "render",
      "cleanup:0",
      "one:1",
      "render",
      "render",
      "render",
      "cleanup:1",
      "one:4",
      "cleanup:4",
    ]);
  },
  "key useEffect calls effect cleanup when not conditionally executed": () => {
    const log = [];
    let setter;
    let numSetter;
    const Component = () => {
      log.push("render");
      const [callEffect, setCallEffect] = useState("a", false);
      const [num, setNum] = useState("b", 1);
      if (callEffect) {
        useEffect(
          "c",
          () => {
            log.push(`effect:${num}`);
            return () => {
              log.push(`cleanup:${num}`);
            };
          },
          [num],
        );
      }
      setter = setCallEffect;
      numSetter = setNum;
    };
    const unmount = mount(Component);
    assert.deepEqual(log, ["render"]);
    setter(true);
    assert.deepEqual(log, ["render", "render", "effect:1"]);
    numSetter(2);
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
    ]);
    setter(false);
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
      "render",
      "cleanup:2",
    ]);
    numSetter(3);
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
      "render",
      "cleanup:2",
      "render",
    ]);
    numSetter(4);
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
      "render",
      "cleanup:2",
      "render",
      "render",
    ]);
    setter(true);
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
      "render",
      "cleanup:2",
      "render",
      "render",
      "render",
      "effect:4",
    ]);
    unmount();
    assert.deepEqual(log, [
      "render",
      "render",
      "effect:1",
      "render",
      "cleanup:1",
      "effect:2",
      "render",
      "cleanup:2",
      "render",
      "render",
      "render",
      "effect:4",
      "cleanup:4",
    ]);
  },
};

async function runTests() {
  for (const [testName, testImpl] of Object.entries(tests)) {
    logSync(`\x1b[33mTEST\x1b[0m ${testName}`);
    try {
      await testImpl();
    } catch (e) {
      logSync(`\r\x1b[31mFAIL\x1b[0m\n\n`);
      console.log(e);
      process.exit(1);
      return;
    }
    logSync(`\r\x1b[32mPASS\x1b[0m\n`);
  }
}

runTests();
