let activeInstance = undefined;

export function mount(Component) {
  // The component's instance state
  const instance = {
    Component,
    initialized: false,
    hookStateIndex: 0,
    hookState: [],
  };

  // Render the component
  render(instance);
  instance.initialized = true;

  // Unmount cleans up effects
  return () => {
    instance.hookState.forEach((slot) => {
      if (slot.type === "useEffect" && slot.cleanupFn) {
        slot.cleanupFn();
      }
    });
  };
}

function render(instance) {
  // A component may render while another is rendering
  const prevInstance = activeInstance;

  activeInstance = instance;

  // Reset execution index before calling
  activeInstance.hookStateIndex = 0;
  activeInstance.Component();

  // Restore previous active instance
  activeInstance = prevInstance;
}

export function useState(initialValue) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot;
  if (!instance.initialized) {
    // On first render, add new slot to the execution index
    slot = {
      type: "useState",
      value: typeof initialValue === "function" ? initialValue() : initialValue,
      setValue: (setter) => {
        let newValue;
        if (typeof setter === "function") {
          newValue = setter(slot.value);
        } else {
          newValue = setter;
        }
        if (slot.value !== newValue) {
          // Trigger rerender on state change
          slot.value = newValue;
          render(instance);
        }
      },
    };
    instance.hookState.push(slot);
  } else {
    // On update, get next slot state from execution index
    slot = instance.hookState[instance.hookStateIndex];
    instance.hookStateIndex += 1;
    if (!slot || slot.type !== "useState") {
      throw new Error("Invariant: you broke the rules!");
    }
  }
  return [slot.value, slot.setValue];
}

export function useMemo(fn, dependencies) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot;
  if (!instance.initialized) {
    // On first render, add new slot to the execution index
    slot = {
      type: "useMemo",
      value: fn(),
      dependencies,
    };
    instance.hookState.push(slot);
  } else {
    // On update, get next slot state from execution index
    slot = instance.hookState[instance.hookStateIndex];
    instance.hookStateIndex += 1;
    if (!slot || slot.type !== "useMemo") {
      throw new Error("Invariant: you broke the rules!");
    }
    let cacheHit = true;
    for (let i = 0; i < dependencies.length; ++i) {
      if (dependencies[i] !== slot.dependencies[i]) {
        cacheHit = false;
        break;
      }
    }
    if (!cacheHit) {
      slot.dependencies = dependencies;
      slot.value = fn();
    }
  }
  return slot.value;
}

export function useEffect(fn, dependencies) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot;
  if (!instance.initialized) {
    // On first render, add new slot to the execution index
    slot = {
      type: "useEffect",
      cleanupFn: fn(),
      dependencies,
    };
    instance.hookState.push(slot);
  } else {
    // On update, get next slot state from execution index
    slot = instance.hookState[instance.hookStateIndex];
    instance.hookStateIndex += 1;
    if (!slot || slot.type !== "useEffect") {
      throw new Error("Invariant: you broke the rules!");
    }
    let cacheHit = true;
    for (let i = 0; i < dependencies.length; ++i) {
      if (dependencies[i] !== slot.dependencies[i]) {
        cacheHit = false;
        break;
      }
    }
    if (!cacheHit) {
      if (slot.cleanupFn) {
        slot.cleanupFn();
      }
      slot.dependencies = dependencies;
      slot.cleanupFn = fn();
    }
  }
  return slot.value;
}
