let activeInstance = undefined;

export function mount(Component) {
  // The component's instance state
  const instance = {
    Component,
    hookState: new Map(),
  };

  // Render the component
  render(instance);

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

  // Set hooks as inactive unless called
  for (const [key, slot] of activeInstance.hookState) {
    slot.active = false;
  }
  activeInstance.Component();

  // Clean up inactive hooks
  const toRemove = [];
  for (const [key, slot] of activeInstance.hookState) {
    if (slot.type === "useEffect" && !slot.active) {
      slot.cleanupFn?.();
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    activeInstance.hookState.delete(key);
  }

  // Restore previous active instance
  activeInstance = prevInstance;
}

export function useState(key, initialValue) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot = instance.hookState.get(key);
  if (!slot) {
    // On new key, add new slot
    slot = {
      type: "useState",
      active: true,
      value: typeof initialValue === "function" ? initialValue() : initialValue,
      setValue: (setter) => {
        let newValue =
          typeof setter === "function" ? setter(slot.value) : setter;
        if (slot.value !== newValue) {
          slot.value = newValue;
          if (slot.active) {
            // Trigger rerender when active
            render(instance);
          }
        }
      },
    };
    instance.hookState.set(key, slot);
  } else {
    if (slot.type !== "useState") {
      throw new Error("Invariant: you broke the rules!");
    }
    slot.active = true;
  }
  return [slot.value, slot.setValue];
}

export function useMemo(key, fn, dependencies) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot = instance.hookState.get(key);
  if (!slot) {
    // On new key, add new slot
    slot = {
      type: "useMemo",
      active: true,
      value: fn(),
      dependencies,
    };
    instance.hookState.set(key, slot);
  } else {
    if (slot.type !== "useMemo") {
      throw new Error("Invariant: you broke the rules!");
    }
    slot.active = true;
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

export function useEffect(key, fn, dependencies) {
  if (activeInstance === undefined) {
    throw new Error("Invariant: useState() called outside of a component!");
  }
  const instance = activeInstance;
  let slot = instance.hookState.get(key);
  if (!slot) {
    // On new key, add new slot
    slot = {
      type: "useEffect",
      active: true,
      cleanupFn: fn(),
      dependencies,
    };
    instance.hookState.set(key, slot);
  } else {
    if (slot.type !== "useEffect") {
      throw new Error("Invariant: you broke the rules!");
    }
    slot.active = true;
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
