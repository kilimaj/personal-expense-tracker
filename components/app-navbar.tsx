'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import NextLink from 'next/link'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Link,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Switch,
  Divider,
} from '@heroui/react'
import { Wallet, Moon, Sun, LogOut, Settings } from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/expenses',  label: 'Expenses'  },
  { href: '/budgets',   label: 'Budgets'   },
  { href: '/reports',   label: 'Reports'   },
] as const

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'
}

export function AppNavbar() {
  const pathname           = usePathname()
  const { data: session }  = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDark,     setIsDark]     = useState(true)

  function handleDarkToggle(checked: boolean) {
    setIsDark(checked)
    document.documentElement.classList.toggle('dark', checked)
  }

  function handleSignOut() {
    signOut({ callbackUrl: '/login' })
  }

  const name     = session?.user?.name  ?? ''
  const email    = session?.user?.email ?? ''
  const initials = getInitials(name)

  return (
    <Navbar
      maxWidth="xl"
      isBordered
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* ── Left: hamburger (mobile only) + brand ── */}
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          className="sm:hidden"
        />
        <NavbarBrand>
          <NextLink
            href="/dashboard"
            className="flex items-center gap-2 text-foreground"
          >
            <Wallet size={22} className="text-primary" aria-hidden="true" />
            <span className="font-bold text-lg">Spendly</span>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      {/* ── Centre: nav links (desktop only) ── */}
      <NavbarContent className="hidden sm:flex gap-1" justify="center">
        {NAV_LINKS.map(({ href, label }) => (
          <NavbarItem key={href} isActive={isActive(pathname, href)}>
            <Link
              as={NextLink}
              href={href}
              color={isActive(pathname, href) ? 'primary' : 'foreground'}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className="px-2"
            >
              {label}
            </Link>
          </NavbarItem>
        ))}
      </NavbarContent>

      {/* ── Right: dark mode toggle + user dropdown ── */}
      <NavbarContent justify="end" className="gap-2">

        {/* Dark mode switch */}
        <NavbarItem>
          <Switch
            isSelected={isDark}
            onValueChange={handleDarkToggle}
            size="sm"
            aria-label="Toggle dark mode"
            thumbIcon={({ isSelected }) =>
              isSelected
                ? <Moon size={10} aria-hidden="true" />
                : <Sun  size={10} aria-hidden="true" />
            }
          />
        </NavbarItem>

        {/* User profile dropdown */}
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                as="button"
                size="sm"
                color="primary"
                name={initials}
                className="cursor-pointer transition-opacity hover:opacity-80"
                aria-label="Open user menu"
              />
            </DropdownTrigger>

            <DropdownMenu
              aria-label="User account actions"
              disabledKeys={['user-info']}
            >
              {/* Profile header — shows name + email, not interactive */}
              <DropdownItem
                key="user-info"
                isReadOnly
                className="opacity-100 cursor-default"
                textValue={name || email}
                startContent={
                  <Avatar
                    size="sm"
                    color="primary"
                    name={initials}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                }
              >
                <div className="flex flex-col">
                  {name  && <span className="font-semibold text-sm leading-tight">{name}</span>}
                  {email && <span className="text-xs text-default-400 leading-tight">{email}</span>}
                </div>
              </DropdownItem>

              {/* Settings */}
              <DropdownItem
                key="settings"
                href="/settings"
                startContent={<Settings size={15} aria-hidden="true" />}
              >
                Settings
              </DropdownItem>

              {/* Sign out — separated visually, destructive color */}
              <DropdownItem
                key="signout"
                color="danger"
                showDivider
                startContent={<LogOut size={15} aria-hidden="true" />}
                onPress={handleSignOut}
              >
                Sign out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      {/* ── Mobile slide-out menu ── */}
      <NavbarMenu className="gap-1 pt-4">
        {/* Nav links */}
        {NAV_LINKS.map(({ href, label }) => (
          <NavbarMenuItem key={href}>
            <Link
              as={NextLink}
              href={href}
              size="lg"
              color={isActive(pathname, href) ? 'primary' : 'foreground'}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className="w-full"
              onPress={() => setIsMenuOpen(false)}
            >
              {label}
            </Link>
          </NavbarMenuItem>
        ))}

        {/* Divider before profile section */}
        <NavbarMenuItem>
          <Divider className="my-2" />
        </NavbarMenuItem>

        {/* User info — display only */}
        {(name || email) && (
          <NavbarMenuItem>
            <div className="flex items-center gap-3 px-1 py-1">
              <Avatar
                size="sm"
                color="primary"
                name={initials}
                aria-hidden="true"
              />
              <div className="flex flex-col">
                {name  && <span className="text-sm font-semibold leading-tight">{name}</span>}
                {email && <span className="text-xs text-default-400 leading-tight">{email}</span>}
              </div>
            </div>
          </NavbarMenuItem>
        )}

        {/* Settings link */}
        <NavbarMenuItem>
          <Link
            as={NextLink}
            href="/settings"
            size="lg"
            color="foreground"
            className="w-full flex items-center gap-2"
            onPress={() => setIsMenuOpen(false)}
          >
            <Settings size={16} aria-hidden="true" />
            Settings
          </Link>
        </NavbarMenuItem>

        {/* Sign out */}
        <NavbarMenuItem>
          <button
            onClick={() => { setIsMenuOpen(false); handleSignOut() }}
            className="flex items-center gap-2 text-lg text-danger w-full text-left py-1"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </NavbarMenuItem>
      </NavbarMenu>
    </Navbar>
  )
}
