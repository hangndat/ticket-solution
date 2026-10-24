import ExpoModulesCore
import Security

public class GateKeychainIndexModule: Module {
  private let gateServices = ["app", "app:no-auth", "app:auth"]
  private let queueServices = [
    "ticket-foundation.gate-offline-queue",
    "ticket-foundation.gate-offline-queue:no-auth",
    "ticket-foundation.gate-offline-queue:auth"
  ]

  private func accounts(service: String) throws -> [String] {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecMatchLimit as String: kSecMatchLimitAll,
      kSecReturnAttributes as String: true
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return [] }
    guard status == errSecSuccess, let rows = result as? [[String: Any]] else {
      throw NSError(domain: "GateKeychainIndex", code: Int(status))
    }
    return try rows.compactMap { row in
      guard let accountData = row[kSecAttrAccount as String] as? Data,
            let account = String(data: accountData, encoding: .utf8) else {
        throw NSError(domain: "GateKeychainIndex", code: -1)
      }
      let relevant = account == "ticket.gate.ops.v1" ||
        account.hasPrefix("ticket.gate.workspace.v2.") ||
        account.hasPrefix("ticket.staff.gate.scope.v1.") ||
        account.hasPrefix("ticket.gate.offline-queue.v1.") ||
        account.hasPrefix("ticket.gate.offline-seq.v1.")
      if !relevant { return nil }
      guard let generic = row[kSecAttrGeneric as String] as? Data,
            generic == accountData else {
        throw NSError(domain: "GateKeychainIndex", code: -2)
      }
      return account
    }
  }

  public func definition() -> ModuleDefinition {
    Name("GateKeychainIndex")
    AsyncFunction("listGateLegacyKeys") { () throws -> [String: Any] in
      var workspace = Set<String>()
      var scope = Set<String>()
      var queue = Set<String>()
      var legacy = false
      for service in gateServices {
        for account in try accounts(service: service) {
          if account == "ticket.gate.ops.v1" { legacy = true }
          if account.hasPrefix("ticket.gate.workspace.v2.") {
            let id = String(account.dropFirst("ticket.gate.workspace.v2.".count))
            guard !id.isEmpty else { throw NSError(domain: "GateKeychainIndex", code: -3) }
            workspace.insert(id)
          }
          if account.hasPrefix("ticket.staff.gate.scope.v1.") {
            let id = String(account.dropFirst("ticket.staff.gate.scope.v1.".count))
            guard !id.isEmpty else { throw NSError(domain: "GateKeychainIndex", code: -3) }
            scope.insert(id)
          }
        }
      }
      for service in queueServices {
        for account in try accounts(service: service) {
          for prefix in ["ticket.gate.offline-queue.v1.", "ticket.gate.offline-seq.v1."] {
            if account.hasPrefix(prefix) {
              let id = String(account.dropFirst(prefix.count))
              guard !id.isEmpty else { throw NSError(domain: "GateKeychainIndex", code: -3) }
              queue.insert(id)
            }
          }
        }
      }
      return [
        "workspaceUserIds": workspace.sorted(),
        "scopeUserIds": scope.sorted(),
        "queueUserIds": queue.sorted(),
        "legacyOpsPresent": legacy
      ]
    }
  }
}
