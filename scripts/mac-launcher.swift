import Cocoa
import WebKit

let appName = "{{APP_NAME}}"
let projectPath = "{{PROJECT_PATH}}"
let bunPath = "{{BUN_PATH}}"
let serverURL = URL(string: "http://127.0.0.1:20129")!

final class AppDelegate: NSObject, NSApplicationDelegate {
	var window: NSWindow?
	var webView: WKWebView?
	var server: Process?

	func applicationDidFinishLaunching(_ notification: Notification) {
		setupMenu()
		showWindow()
		startServer()
	}

	func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
		true
	}

	func applicationWillTerminate(_ notification: Notification) {
		server?.terminate()
	}

	func setupMenu() {
		let mainMenu = NSMenu()

		// App Menu
		let appMenuItem = NSMenuItem()
		mainMenu.addItem(appMenuItem)
		let appMenu = NSMenu()
		appMenuItem.submenu = appMenu

		let quitMenuItem = NSMenuItem(
			title: "Quit \(appName)",
			action: #selector(NSApplication.terminate(_:)),
			keyEquivalent: "q"
		)
		appMenu.addItem(quitMenuItem)

		// File Menu
		let fileMenuItem = NSMenuItem()
		mainMenu.addItem(fileMenuItem)
		let fileMenu = NSMenu(title: "File")
		fileMenuItem.submenu = fileMenu

		let closeMenuItem = NSMenuItem(
			title: "Close Window",
			action: #selector(NSWindow.performClose(_:)),
			keyEquivalent: "w"
		)
		fileMenu.addItem(closeMenuItem)

		// Edit Menu
		let editMenuItem = NSMenuItem()
		mainMenu.addItem(editMenuItem)
		let editMenu = NSMenu(title: "Edit")
		editMenuItem.submenu = editMenu

		editMenu.addItem(NSMenuItem(title: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z"))
		editMenu.addItem(NSMenuItem(title: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z"))
		editMenu.addItem(NSMenuItem.separator())
		editMenu.addItem(NSMenuItem(title: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
		editMenu.addItem(NSMenuItem(title: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
		editMenu.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
		editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))

		NSApp.mainMenu = mainMenu
	}

	func showWindow() {
		let config = WKWebViewConfiguration()
		let webView = WKWebView(frame: .zero, configuration: config)
		webView.setValue(false, forKey: "drawsBackground")
		if #available(macOS 12.0, *) {
			webView.underPageBackgroundColor = .clear
		}
		webView.translatesAutoresizingMaskIntoConstraints = false

		let blurView = NSVisualEffectView(frame: .zero)
		blurView.material = .hudWindow
		blurView.blendingMode = .behindWindow
		blurView.state = .active
		blurView.wantsLayer = true
		blurView.layer?.backgroundColor = NSColor.clear.cgColor
		blurView.translatesAutoresizingMaskIntoConstraints = false

		let window = NSWindow(
			contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
			styleMask: [.titled, .closable, .resizable, .miniaturizable],
			backing: .buffered,
			defer: false
		)
		window.title = appName
		window.titlebarAppearsTransparent = true
		window.titleVisibility = .hidden
		window.isMovableByWindowBackground = true
		window.isOpaque = false
		window.hasShadow = true
		window.backgroundColor = .clear
		window.center()

		guard let containerView = window.contentView else { return }

		containerView.addSubview(blurView)
		containerView.addSubview(webView)

		NSLayoutConstraint.activate([
			blurView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
			blurView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
			blurView.topAnchor.constraint(equalTo: containerView.topAnchor),
			blurView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

			webView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
			webView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
			webView.topAnchor.constraint(equalTo: containerView.topAnchor),
			webView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
		])
		window.makeKeyAndOrderFront(nil)
		NSApp.activate(ignoringOtherApps: true)

		// Show instant dark loading screen while Next.js boots up (takes ~100-200ms)
		webView.loadHTMLString("""
		<html>
		<head>
		<style>
		body {
			background-color: transparent;
			color: #a1a1aa;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100vh;
			margin: 0;
			user-select: none;
		}
		.container {
			text-align: center;
		}
		.spinner {
			border: 2px solid rgba(255,255,255,0.05);
			border-left-color: #4f46e5;
			border-radius: 50%;
			width: 28px;
			height: 28px;
			animation: spin 0.8s linear infinite;
			margin: 0 auto 16px;
		}
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		.text {
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.24em;
			color: #6366f1;
			font-weight: 600;
		}
		</style>
		</head>
		<body>
			<div class="container">
				<div class="spinner"></div>
				<div class="text">Summoning Council...</div>
			</div>
		</body>
		</html>
		""", baseURL: nil)

		self.window = window
		self.webView = webView
	}

	func startServer() {
		let process = Process()
		
		let bundlePath = Bundle.main.resourcePath ?? ""
		let appDir = (bundlePath as NSString).appendingPathComponent("app")
		let serverScriptPath = (appDir as NSString).appendingPathComponent("server.js")

		process.currentDirectoryURL = URL(fileURLWithPath: appDir)
		process.executableURL = URL(fileURLWithPath: bunPath)
		process.arguments = [serverScriptPath]
		process.environment = [
			"PATH": "{{BUN_DIR}}:" + (ProcessInfo.processInfo.environment["PATH"] ?? ""),
			"PORT": "20129",
			"HOSTNAME": "127.0.0.1"
		]
		process.standardOutput = Pipe()
		process.standardError = Pipe()

		do {
			try process.run()
			server = process
			waitForServer()
		} catch {
			showError("Could not start \(appName) server: \(error.localizedDescription)")
		}
	}

	func waitForServer() {
		Task {
			// Fast polling: check every 50ms (up to 120 times, total 6 seconds)
			for _ in 0..<120 {
				if await isServerReady() {
					_ = await MainActor.run {
						webView?.load(URLRequest(url: serverURL))
					}
					return
				}
				try? await Task.sleep(nanoseconds: 50_000_000)
			}
			await MainActor.run {
				showError("Timed out waiting for \(appName) server.")
			}
		}
	}

	func isServerReady() async -> Bool {
		var request = URLRequest(url: serverURL)
		request.timeoutInterval = 0.5
		do {
			let (_, response) = try await URLSession.shared.data(for: request)
			return (response as? HTTPURLResponse)?.statusCode != nil
		} catch {
			return false
		}
	}

	func showError(_ message: String) {
		let alert = NSAlert()
		alert.messageText = "\(appName) failed to start"
		alert.informativeText = message
		alert.runModal()
		NSApp.terminate(nil)
	}
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
