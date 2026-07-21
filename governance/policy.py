from __future__ import annotations

from enum import StrEnum

from .context import ExecutionContext


class CapabilityClass(StrEnum):
    READ_ONLY = "read_only"
    LOCAL_WRITE = "local_write"
    EXTERNAL = "external"
    THIRD_PARTY_CONTROL = "third_party_control"
    PROHIBITED = "prohibited"


class GovernancePolicy:
    """Default-deny policy for tool classes that can create side effects."""

    _classes: dict[str, CapabilityClass] = {
        "memory_read": CapabilityClass.READ_ONLY,
        "memory_search": CapabilityClass.READ_ONLY,
        "pdf_reader": CapabilityClass.READ_ONLY,
        "filesystem": CapabilityClass.LOCAL_WRITE,
        "memory_write": CapabilityClass.LOCAL_WRITE,
        "git": CapabilityClass.LOCAL_WRITE,
        "python_exec": CapabilityClass.LOCAL_WRITE,
        "web_search": CapabilityClass.EXTERNAL,
        "eq_send_keys": CapabilityClass.THIRD_PARTY_CONTROL,
        "eq_read_screen": CapabilityClass.THIRD_PARTY_CONTROL,
        "eq_wait": CapabilityClass.THIRD_PARTY_CONTROL,
    }

    def classify(self, tool_name: str) -> CapabilityClass:
        # Unknown capabilities are denied. Treating an unregistered tool as
        # read-only would let a newly added side-effecting tool bypass policy.
        return self._classes.get(tool_name, CapabilityClass.PROHIBITED)

    def authorize(
        self,
        tool_name: str,
        context: ExecutionContext | None,
    ) -> tuple[bool, str | None]:
        capability = self.classify(tool_name)
        if capability is CapabilityClass.PROHIBITED:
            if tool_name not in self._classes:
                return False, f"Tool '{tool_name}' is not registered in governance policy"
            return False, f"Tool '{tool_name}' is prohibited by governance policy"
        if context is None:
            if capability is CapabilityClass.READ_ONLY:
                return True, None
            return False, f"Tool '{tool_name}' requires a governed task context"
        if context.cancelled:
            return False, "Task cancellation has been requested"
        if capability is CapabilityClass.THIRD_PARTY_CONTROL:
            return False, f"Tool '{tool_name}' is disabled outside an approved sandbox"
        needs_approval = capability in {CapabilityClass.LOCAL_WRITE, CapabilityClass.EXTERNAL}
        if needs_approval and not context.permits(tool_name):
            return False, f"Tool '{tool_name}' requires explicit approval for this task"
        return True, None
