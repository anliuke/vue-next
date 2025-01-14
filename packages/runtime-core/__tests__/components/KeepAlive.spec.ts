import {
  h,
  TestElement,
  nodeOps,
  render,
  ref,
  KeepAlive,
  serializeInner,
  nextTick,
  ComponentOptions
} from '@vue/runtime-test'
import { KeepAliveProps } from '../../src/components/KeepAlive'

describe('keep-alive', () => {
  let one: ComponentOptions
  let two: ComponentOptions
  let views: Record<string, ComponentOptions>
  let root: TestElement

  beforeEach(() => {
    root = nodeOps.createElement('div')
    one = {
      name: 'one',
      data: () => ({ msg: 'one' }),
      render() {
        return h('div', this.msg)
      },
      created: jest.fn(),
      mounted: jest.fn(),
      activated: jest.fn(),
      deactivated: jest.fn(),
      unmounted: jest.fn()
    }
    two = {
      name: 'two',
      data: () => ({ msg: 'two' }),
      render() {
        return h('div', this.msg)
      },
      created: jest.fn(),
      mounted: jest.fn(),
      activated: jest.fn(),
      deactivated: jest.fn(),
      unmounted: jest.fn()
    }
    views = {
      one,
      two
    }
  })

  function assertHookCalls(component: any, callCounts: number[]) {
    expect([
      component.created.mock.calls.length,
      component.mounted.mock.calls.length,
      component.activated.mock.calls.length,
      component.deactivated.mock.calls.length,
      component.unmounted.mock.calls.length
    ]).toEqual(callCounts)
  }

  test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)
    const App = {
      render() {
        return h(KeepAlive, null, {
          default: () => h(views[viewRef.value], { ref: instanceRef })
        })
      }
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    instanceRef.value.msg = 'changed'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>changed</div>`)
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>changed</div>`)
  })

  test('should call correct lifecycle hooks', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return toggle.value ? h(KeepAlive, () => h(views[viewRef.value])) : null
      }
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    // toggle kept-alive component
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    // teardown keep-alive, should unmount all components including cached
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 1])
    assertHookCalls(two, [1, 1, 2, 2, 1])
  })

  test('should call lifecycle hooks on nested components', async () => {
    one.render = () => h(two)

    const toggle = ref(true)
    const App = {
      render() {
        return h(KeepAlive, () => (toggle.value ? h(one) : null))
      }
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 2, 2, 0])
  })

  test('should call correct hooks for nested keep-alive', async () => {
    const toggle2 = ref(true)
    one.render = () => h(KeepAlive, () => (toggle2.value ? h(two) : null))

    const toggle1 = ref(true)
    const App = {
      render() {
        return h(KeepAlive, () => (toggle1.value ? h(one) : null))
      }
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    toggle1.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    // toggle nested instance
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 2, 0])

    toggle2.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 3, 2, 0])

    toggle1.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0])

    // toggle nested instance when parent is deactivated
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0]) // should not be affected

    toggle2.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0]) // should not be affected

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 3, 2, 0])
    assertHookCalls(two, [1, 1, 4, 3, 0])

    toggle1.value = false
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 3, 3, 0])
    assertHookCalls(two, [1, 1, 4, 4, 0])

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 4, 3, 0])
    assertHookCalls(two, [1, 1, 4, 4, 0]) // should remain inactive
  })

  async function assertNameMatch(props: KeepAliveProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return outerRef.value
          ? h(KeepAlive, props, () => h(views[viewRef.value]))
          : null
      }
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 1])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [2, 2, 0, 0, 1])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 1])
    assertHookCalls(two, [2, 2, 0, 0, 2])
  }

  describe('props', () => {
    test('include (string)', async () => {
      await assertNameMatch({ include: 'one' })
    })

    test('include (regex)', async () => {
      await assertNameMatch({ include: /^one$/ })
    })

    test('include (array)', async () => {
      await assertNameMatch({ include: ['one'] })
    })

    test('exclude (string)', async () => {
      await assertNameMatch({ exclude: 'two' })
    })

    test('exclude (regex)', async () => {
      await assertNameMatch({ exclude: /^two$/ })
    })

    test('exclude (array)', async () => {
      await assertNameMatch({ exclude: ['two'] })
    })

    test('include + exclude', async () => {
      await assertNameMatch({ include: 'one,two', exclude: 'two' })
    })

    test('max', async () => {
      const spyA = jest.fn()
      const spyB = jest.fn()
      const spyC = jest.fn()
      const spyAD = jest.fn()
      const spyBD = jest.fn()
      const spyCD = jest.fn()

      function assertCount(calls: number[]) {
        expect([
          spyA.mock.calls.length,
          spyAD.mock.calls.length,
          spyB.mock.calls.length,
          spyBD.mock.calls.length,
          spyC.mock.calls.length,
          spyCD.mock.calls.length
        ]).toEqual(calls)
      }

      const viewRef = ref('a')
      const views: Record<string, ComponentOptions> = {
        a: {
          render: () => `one`,
          created: spyA,
          unmounted: spyAD
        },
        b: {
          render: () => `two`,
          created: spyB,
          unmounted: spyBD
        },
        c: {
          render: () => `three`,
          created: spyC,
          unmounted: spyCD
        }
      }

      const App = {
        render() {
          return h(KeepAlive, { max: 2 }, () => {
            return h(views[viewRef.value])
          })
        }
      }
      render(h(App), root)
      assertCount([1, 0, 0, 0, 0, 0])

      viewRef.value = 'b'
      await nextTick()
      assertCount([1, 0, 1, 0, 0, 0])

      viewRef.value = 'c'
      await nextTick()
      // should prune A because max cache reached
      assertCount([1, 1, 1, 0, 1, 0])

      viewRef.value = 'b'
      await nextTick()
      // B should be reused, and made latest
      assertCount([1, 1, 1, 0, 1, 0])

      viewRef.value = 'a'
      await nextTick()
      // C should be pruned because B was used last so C is the oldest cached
      assertCount([2, 1, 1, 0, 1, 1])
    })
  })

  describe('cache invalidation', () => {
    function setup() {
      const viewRef = ref('one')
      const includeRef = ref('one,two')
      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: includeRef.value
            },
            () => h(views[viewRef.value])
          )
        }
      }
      render(h(App), root)
      return { viewRef, includeRef }
    }

    test('on include/exclude change', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [2, 2, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 1, 0])
    })

    test('on include/exclude change + view switch', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      includeRef.value = 'one'
      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [1, 1, 2, 1, 0])
      // two should be pruned
      assertHookCalls(two, [1, 1, 1, 1, 1])
    })

    test('should not prune current active instance', async () => {
      const { viewRef, includeRef } = setup()

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 0, 0])
      assertHookCalls(two, [0, 0, 0, 0, 0])

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 0, 1])
      assertHookCalls(two, [1, 1, 1, 0, 0])
    })

    async function assertAnonymous(include: boolean) {
      const one = {
        name: 'one',
        created: jest.fn(),
        render: () => 'one'
      }

      const two = {
        // anonymous
        created: jest.fn(),
        render: () => 'two'
      }

      const views: any = { one, two }
      const viewRef = ref('one')

      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: include ? 'one' : undefined
            },
            () => h(views[viewRef.value])
          )
        }
      }
      render(h(App), root)

      function assert(oneCreateCount: number, twoCreateCount: number) {
        expect(one.created.mock.calls.length).toBe(oneCreateCount)
        expect(two.created.mock.calls.length).toBe(twoCreateCount)
      }

      assert(1, 0)

      viewRef.value = 'two'
      await nextTick()
      assert(1, 1)

      viewRef.value = 'one'
      await nextTick()
      assert(1, 1)

      viewRef.value = 'two'
      await nextTick()
      // two should be re-created if include is specified, since it's not matched
      // otherwise it should be cached.
      assert(1, include ? 2 : 1)
    }

    // 2.x #6938
    test('should not cache anonymous component when include is specified', async () => {
      await assertAnonymous(true)
    })

    test('should cache anonymous components if include is not specified', async () => {
      await assertAnonymous(false)
    })

    // 2.x #7105
    test('should not destroy active instance when pruning cache', async () => {
      const Foo = {
        render: () => 'foo',
        unmounted: jest.fn()
      }
      const includeRef = ref(['foo'])
      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: includeRef.value
            },
            () => h(Foo)
          )
        }
      }
      render(h(App), root)
      // condition: a render where a previous component is reused
      includeRef.value = ['foo', 'bar']
      await nextTick()
      includeRef.value = []
      await nextTick()
      expect(Foo.unmounted).not.toHaveBeenCalled()
    })
  })
})
